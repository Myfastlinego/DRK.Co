/* M.BizAccount admin recovery + progressive login lockout */
(function () {
  'use strict';

  const LOCK_KEY = 'mbizaccount_login_lockouts_v5';
  const MAX_BACKOFF_MINUTES = 60;
  let initialized = false;

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
    const key = normalize(email);
    if (!key) return { fails: 0, lockedUntil: 0 };
    const state = readState();
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
    const box = $('authError');
    if (box) {
      box.textContent = message;
      box.style.display = '';
    } else if (typeof window.mbizAuthError === 'function') {
      window.mbizAuthError(message);
    }
  }

  function clearError() {
    const box = $('authError');
    if (box) box.style.display = 'none';
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

    if (button.textContent.indexOf('Locked ') === 0) {
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
    const key = normalize(email);
    if (key) delete state[key];
    saveState(state);
  }

  async function waitForSupabase(timeoutMs) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (window.mbizSupabase?.auth) return window.mbizSupabase;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return null;
  }

  async function forgotPassword() {
    const email = ($('authEmail')?.value || '').trim();
    if (!email) {
      showError('Enter your admin email first.');
      $('authEmail')?.focus();
      return;
    }

    const button = $('forgotPasswordBtn');
    if (button) {
      button.disabled = true;
      button.textContent = 'Sending...';
    }
    clearError();
    setStatus('Connecting to secure password recovery…');

    try {
      const client = await waitForSupabase(5000);
      if (!client || typeof client.auth.resetPasswordForEmail !== 'function') {
        throw new Error('Supabase auth is unavailable');
      }

      const redirectTo = window.location.origin + window.location.pathname;
      const result = await client.auth.resetPasswordForEmail(email, { redirectTo });
      if (result?.error) throw result.error;

      setStatus('Password reset email requested. Check the inbox for this User ID.');
      clearError();
    } catch (error) {
      console.error('Password recovery failed:', error);
      showError('Password reset could not be sent. Check the User ID/email and try again.');
      setStatus('Password recovery failed.');
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = 'Forgot Password?';
      }
    }
  }

  function forgotUserId() {
    clearError();
    setStatus('User ID = the admin email address registered in Supabase for M.BizAccount.');
  }

  function addRecoveryButtons() {
    const card = document.querySelector('.auth-card');
    if (!card) return false;
    if ($('authRecovery')) return true;

    const wrap = document.createElement('div');
    wrap.id = 'authRecovery';
    wrap.style.cssText = 'display:flex;justify-content:center;gap:10px;flex-wrap:wrap;margin-top:13px';

    const passwordBtn = document.createElement('button');
    passwordBtn.type = 'button';
    passwordBtn.className = 'secondary';
    passwordBtn.id = 'forgotPasswordBtn';
    passwordBtn.textContent = 'Forgot Password?';
    passwordBtn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      void forgotPassword();
    });

    const userIdBtn = document.createElement('button');
    userIdBtn.type = 'button';
    userIdBtn.className = 'secondary';
    userIdBtn.id = 'forgotUserIdBtn';
    userIdBtn.textContent = 'Forgot User ID?';
    userIdBtn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      forgotUserId();
    });

    wrap.appendChild(passwordBtn);
    wrap.appendChild(userIdBtn);
    card.appendChild(wrap);
    return true;
  }

  function installLogin() {
    if (initialized) return true;
    const emailInput = $('authEmail');
    const passwordInput = $('authPassword');
    const submitButton = $('authSubmit');
    if (!emailInput || !passwordInput || !submitButton) return false;

    window.mbizLogin = async function (event) {
      if (event) event.preventDefault();

      const email = emailInput.value.trim();
      const password = passwordInput.value || '';
      if (!email) { emailInput.focus(); return false; }
      if (!password) { passwordInput.focus(); return false; }
      if (applyLockUI()) return false;

      clearError();
      submitButton.disabled = true;
      submitButton.textContent = 'Signing in...';
      setStatus('Checking your account…');

      try {
        const client = await waitForSupabase(5000);
        if (!client || typeof client.auth.signInWithPassword !== 'function') {
          throw new Error('Authentication service unavailable');
        }

        const { error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;

        clearFailures(email);
        setStatus('Signed in.');
        return true;
      } catch (error) {
        console.error('Sign in failed:', error);
        if (String(error?.message || '').toLowerCase().includes('authentication service unavailable')) {
          showError('Authentication service is unavailable. Please refresh and try again.');
          setStatus('Secure sign-in is temporarily unavailable.');
          return false;
        }

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
        if (!applyLockUI()) {
          submitButton.disabled = false;
          submitButton.textContent = 'Sign In';
        }
      }
    };

    initialized = true;
    return true;
  }

  function init() {
    addRecoveryButtons();
    installLogin();
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
