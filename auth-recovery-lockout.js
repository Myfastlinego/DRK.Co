/* M.BizAccount admin recovery + progressive login lockout */
(function () {
  'use strict';

  const LOCK_KEY = 'mbizaccount_login_lockouts_v2';
  const MAX_BACKOFF_MINUTES = 60;

  const $ = (id) => document.getElementById(id);
  const normalize = (value) => String(value || '').trim().toLowerCase();

  function readState() {
    try {
      return JSON.parse(localStorage.getItem(LOCK_KEY) || '{}');
    } catch (_) {
      return {};
    }
  }

  function saveState(state) {
    try {
      localStorage.setItem(LOCK_KEY, JSON.stringify(state));
    } catch (_) {}
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

  function formatRemaining(ms) {
    const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    return minutes + 'm ' + seconds + 's';
  }

  function delayMinutes(fails) {
    return fails >= 5 ? Math.min(MAX_BACKOFF_MINUTES, fails - 4) : 0;
  }

  function showError(message) {
    if (typeof window.mbizAuthError === 'function') {
      window.mbizAuthError(message);
      return;
    }
    const error = $('authError');
    if (error) {
      error.textContent = message;
      error.style.display = '';
    }
  }

  function setStatus(message) {
    const status = $('authStatus');
    if (status) status.textContent = message;
  }

  function setBusy(button, busy) {
    if (!button) return;
    button.disabled = busy;
    button.textContent = busy ? 'Signing in...' : 'Sign In';
  }

  function applyLockUI() {
    const email = $('authEmail')?.value || '';
    const entry = getEntry(email);
    const button = $('authSubmit');

    if (entry.lockedUntil > Date.now()) {
      const remaining = formatRemaining(entry.lockedUntil - Date.now());
      if (button) {
        button.disabled = true;
        button.textContent = 'Locked ' + remaining;
      }
      setStatus('Too many failed attempts. Try again in ' + remaining + '.');
      return true;
    }

    if (button && !button.disabled && button.textContent.startsWith('Locked')) {
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
    entry.lockedUntil = minutes > 0 ? Date.now() + minutes * 60000 : 0;
    state[key] = entry;
    saveState(state);

    return { fails: entry.fails, minutes, until: entry.lockedUntil };
  }

  function clearFailures(email) {
    const state = readState();
    delete state[normalize(email)];
    saveState(state);
  }

  window.mbizAuthLockState = getEntry;
  window.mbizAuthRegisterFailure = registerFailure;
  window.mbizAuthClearFailures = clearFailures;
  window.mbizAuthApplyLockUI = applyLockUI;

  window.mbizForgotPassword = async function () {
    const email = ($('authEmail')?.value || '').trim();
    if (!email) {
      showError('Enter your admin email first.');
      return;
    }
    if (!window.mbizSupabase) {
      showError('Authentication service is unavailable. Please refresh the page.');
      return;
    }

    try {
      const { error } = await window.mbizSupabase.auth.resetPasswordForEmail(email, {
        redirectTo: location.origin + location.pathname
      });
      if (error) throw error;
      setStatus('If the account exists, a password reset email has been requested. Check your inbox.');
      const errorBox = $('authError');
      if (errorBox) errorBox.style.display = 'none';
    } catch (error) {
      console.error(error);
      showError('Unable to start password recovery right now. Please try again later.');
    }
  };

  window.mbizForgotUserId = function () {
    setStatus('Your User ID is the admin email registered for this M.BizAccount account.');
    const errorBox = $('authError');
    if (errorBox) errorBox.style.display = 'none';
  };

  function addRecoveryButtons() {
    if ($('authRecovery')) return;
    const card = document.querySelector('.auth-card');
    if (!card) return;

    const wrap = document.createElement('div');
    wrap.id = 'authRecovery';
    wrap.style.cssText = 'display:flex;justify-content:center;gap:10px;flex-wrap:wrap;margin-top:13px';
    wrap.innerHTML =
      '<button type="button" class="secondary" id="forgotPasswordBtn">Forgot Password?</button>' +
      '<button type="button" class="secondary" id="forgotUserIdBtn">Forgot User ID?</button>';

    card.appendChild(wrap);
    $('forgotPasswordBtn')?.addEventListener('click', window.mbizForgotPassword);
    $('forgotUserIdBtn')?.addEventListener('click', window.mbizForgotUserId);
  }

  function replaceLoginHandler() {
    if (window.mbizLogin && window.mbizLogin.__mbizRecoveryWrapped) return;

    window.mbizLogin = async function (event) {
      if (event) event.preventDefault();

      const email = ($('authEmail')?.value || '').trim();
      const password = $('authPassword')?.value || '';
      const button = $('authSubmit');

      if (!email || !password) return;
      if (applyLockUI()) return;
      if (!window.mbizSupabase) {
        showError('Authentication service is unavailable. Please refresh the page.');
        return;
      }

      const errorBox = $('authError');
      if (errorBox) errorBox.style.display = 'none';
      setBusy(button, true);
      setStatus('Checking your account…');

      try {
        const { error } = await window.mbizSupabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        clearFailures(email);
        setStatus('Signed in.');
      } catch (error) {
        console.error(error);
        const result = registerFailure(email);
        const lockedMessage = result.minutes > 0
          ? 'Too many failed attempts. Login for this User ID is locked for ' + result.minutes + ' minute' + (result.minutes === 1 ? '' : 's') + '.'
          : 'Sign in failed. Please check your User ID and password.';
        showError(lockedMessage);
        setStatus(result.minutes > 0 ? lockedMessage : 'Secure sign-in powered by Supabase.');
      } finally {
        if (applyLockUI()) return;
        setBusy(button, false);
      }
    };

    window.mbizLogin.__mbizRecoveryWrapped = true;
  }

  function init() {
    addRecoveryButtons();
    replaceLoginHandler();

    $('authEmail')?.addEventListener('input', applyLockUI);
    $('authPassword')?.addEventListener('input', applyLockUI);
    applyLockUI();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  window.setInterval(function () {
    addRecoveryButtons();
    replaceLoginHandler();
    applyLockUI();
  }, 1000);
})();
