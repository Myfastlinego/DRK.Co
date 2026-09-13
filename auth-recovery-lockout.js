/* M.BizAccount admin recovery + progressive login lockout */
(function () {
  'use strict';

  const LOCK_KEY = 'mbizaccount_login_lockouts_v4';
  const MAX_BACKOFF_MINUTES = 60;
  let ready = false;
  let recoveryButtonsAdded = false;

  const $ = (id) => document.getElementById(id);
  const normalize = (value) => String(value || '').trim().toLowerCase();

  function readState() {
    try { return JSON.parse(localStorage.getItem(LOCK_KEY) || '{}'); }
    catch (_) { return {}; }
  }

  function saveState(state) {
    try { localStorage.setItem(LOCK_KEY, JSON.stringify(state)); }
    catch (_) {}
  }

  function getEntry(email) {
    const state = readState();
    const key = normalize(email);
    const entry = state[key] || { fails: 0, lockedUntil: 0 };
    if (entry.lockedUntil && Date.now() >= entry.lockedUntil) {
      entry.lockedUntil = 0;
      state[key] = entry;
      saveState(state);
    }
    return entry;
  }

  function delayMinutes(fails) {
    return fails >= 5 ? Math.min(MAX_BACKOFF_MINUTES, fails - 4) : 0;
  }

  function formatRemaining(ms) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    return Math.floor(total / 60) + 'm ' + String(total % 60).padStart(2, '0') + 's';
  }

  function setStatus(message) {
    const el = $('authStatus');
    if (el) el.textContent = message;
  }

  function showError(message) {
    if (typeof window.mbizAuthError === 'function') {
      window.mbizAuthError(message);
      return;
    }
    const el = $('authError');
    if (el) {
      el.textContent = message;
      el.style.display = '';
    }
  }

  function clearError() {
    const el = $('authError');
    if (el) el.style.display = 'none';
  }

  function applyLockUI() {
    const button = $('authSubmit');
    const email = $('authEmail')?.value || '';
    if (!button) return false;

    const entry = getEntry(email);
    if (entry.lockedUntil > Date.now()) {
      button.disabled = true;
      button.textContent = 'Locked ' + formatRemaining(entry.lockedUntil - Date.now());
      setStatus('Too many failed attempts. Try again in ' + formatRemaining(entry.lockedUntil - Date.now()) + '.');
      return true;
    }

    if (button.textContent.startsWith('Locked')) {
      button.disabled = false;
      button.textContent = 'Sign In';
    }
    return false;
  }

  function registerFailure(email) {
    const key = normalize(email);
    if (!key) return { fails: 0, minutes: 0, until: 0 };

    const state = readState();
    const entry = state[key] || { fails: 0, lockedUntil: 0 };
    entry.fails = (entry.fails || 0) + 1;
    const minutes = delayMinutes(entry.fails);
    entry.lockedUntil = minutes ? Date.now() + minutes * 60000 : 0;
    state[key] = entry;
    saveState(state);
    return { fails: entry.fails, minutes, until: entry.lockedUntil };
  }

  function clearFailures(email) {
    const state = readState();
    delete state[normalize(email)];
    saveState(state);
  }

  async function forgotPassword() {
    const email = ($('authEmail')?.value || '').trim();
    if (!email) {
      showError('Enter your admin email first.');
      $('authEmail')?.focus();
      return;
    }

    const client = window.mbizSupabase;
    if (!client || !client.auth || typeof client.auth.resetPasswordForEmail !== 'function') {
      showError('Authentication service is not ready. Please wait a moment and try again.');
      return;
    }

    const button = $('forgotPasswordBtn');
    if (button) { button.disabled = true; button.textContent = 'Sending...'; }
    clearError();
    setStatus('Sending password reset request…');

    try {
      const { error } = await client.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + window.location.pathname
      });
      if (error) throw error;
      setStatus('Reset email requested. Check the inbox for the entered User ID.');
    } catch (error) {
      console.error('Password recovery failed:', error);
      showError('Password reset could not be sent. Please check the User ID/email and try again.');
      setStatus('Password recovery failed.');
    } finally {
      if (button) { button.disabled = false; button.textContent = 'Forgot Password?'; }
    }
  }

  function forgotUserId() {
    clearError();
    setStatus('Your User ID is the admin email address registered in Supabase for M.BizAccount.');
  }

  function addRecoveryButtons() {
    const card = document.querySelector('.auth-card');
    if (!card || recoveryButtonsAdded) return;
    if ($('authRecovery')) { recoveryButtonsAdded = true; return; }

    const wrap = document.createElement('div');
    wrap.id = 'authRecovery';
    wrap.style.cssText = 'display:flex;justify-content:center;gap:10px;flex-wrap:wrap;margin-top:13px';

    const forgotPasswordButton = document.createElement('button');
    forgotPasswordButton.type = 'button';
    forgotPasswordButton.className = 'secondary';
    forgotPasswordButton.id = 'forgotPasswordBtn';
    forgotPasswordButton.textContent = 'Forgot Password?';
    forgotPasswordButton.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      forgotPassword();
    });

    const forgotUserIdButton = document.createElement('button');
    forgotUserIdButton.type = 'button';
    forgotUserIdButton.className = 'secondary';
    forgotUserIdButton.id = 'forgotUserIdBtn';
    forgotUserIdButton.textContent = 'Forgot User ID?';
    forgotUserIdButton.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      forgotUserId();
    });

    wrap.appendChild(forgotPasswordButton);
    wrap.appendChild(forgotUserIdButton);
    card.appendChild(wrap);
    recoveryButtonsAdded = true;
  }

  function replaceLogin() {
    if (ready) return;
    if (!$('authSubmit') || !$('authEmail') || !$('authPassword')) return;

    window.mbizLogin = async function (event) {
      if (event) event.preventDefault();

      const email = ($('authEmail').value || '').trim();
      const password = $('authPassword').value || '';
      const button = $('authSubmit');

      if (!email) { $('authEmail').focus(); return false; }
      if (!password) { $('authPassword').focus(); return false; }
      if (applyLockUI()) return false;

      const client = window.mbizSupabase;
      if (!client || !client.auth || typeof client.auth.signInWithPassword !== 'function') {
        showError('Authentication service is not ready. Please wait a moment and try again.');
        return false;
      }

      clearError();
      if (button) { button.disabled = true; button.textContent = 'Signing in...'; }
      setStatus('Checking your account…');

      try {
        const { error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
        clearFailures(email);
        setStatus('Signed in.');
        return true;
      } catch (error) {
        console.error('Sign in failed:', error);
        const result = registerFailure(email);
        if (result.minutes > 0) {
          showError('Too many failed attempts. This User ID is locked for ' + result.minutes + ' minute' + (result.minutes === 1 ? '' : 's') + '.');
          setStatus('Login locked temporarily for this User ID.');
        } else {
          showError('Sign in failed. Please check your User ID and password.');
          setStatus('Secure sign-in powered by Supabase.');
        }
        return false;
      } finally {
        applyLockUI();
        const entry = getEntry(email);
        if (!(entry.lockedUntil > Date.now()) && button) {
          button.disabled = false;
          button.textContent = 'Sign In';
        }
      }
    };

    ready = true;
  }

  function init() {
    addRecoveryButtons();
    replaceLogin();
    applyLockUI();
  }

  window.mbizForgotPassword = forgotPassword;
  window.mbizForgotUserId = forgotUserId;
  window.mbizAuthLockState = getEntry;
  window.mbizAuthRegisterFailure = registerFailure;
  window.mbizAuthClearFailures = clearFailures;
  window.mbizAuthApplyLockUI = applyLockUI;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  setInterval(init, 1000);
})();