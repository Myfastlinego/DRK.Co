/* M.BizAccount admin recovery + progressive login lockout */
(function () {
  'use strict';

  const LOCK_KEY = 'mbizaccount_login_lockouts_v3';
  const MAX_BACKOFF_MINUTES = 60;
  let recoveryButtonsAdded = false;
  let loginHandlerInstalled = false;

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
    const box = $('authError');
    if (box) { box.textContent = message; box.style.display = ''; }
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
    if (!button) return false;

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

  window.mbizAuthLockState = getEntry;
  window.mbizAuthRegisterFailure = registerFailure;
  window.mbizAuthClearFailures = clearFailures;
  window.mbizAuthApplyLockUI = applyLockUI;

  window.mbizForgotPassword = async function () {
    const email = ($('authEmail')?.value || '').trim();
    if (!email) {
      showError('Enter your admin email first.');
      $('authEmail')?.focus();
      return;
    }
    if (!window.mbizSupabase?.auth?.resetPasswordForEmail) {
      showError('Authentication service is unavailable. Please refresh the page.');
      return;
    }

    try {
      const { error } = await window.mbizSupabase.auth.resetPasswordForEmail(email, {
        redirectTo: location.href.split('#')[0]
      });
      if (error) throw error;
      const box = $('authError');
      if (box) box.style.display = 'none';
      setStatus('Password reset request sent. Check the email inbox for this User ID.');
    } catch (error) {
      console.error('Password recovery failed:', error);
      showError('Password reset could not be started. Please verify the User ID and try again.');
    }
  };

  window.mbizForgotUserId = function () {
    const box = $('authError');
    if (box) box.style.display = 'none';
    setStatus('User ID = the admin email address registered in Supabase for this M.BizAccount.');
  };

  function addRecoveryButtons() {
    if (recoveryButtonsAdded || $('authRecovery')) {
      recoveryButtonsAdded = true;
      return;
    }
    const card = document.querySelector('.auth-card');
    if (!card) return;

    const wrap = document.createElement('div');
    wrap.id = 'authRecovery';
    wrap.style.cssText = 'display:flex;justify-content:center;gap:10px;flex-wrap:wrap;margin-top:13px';
    wrap.innerHTML =
      '<button type="button" class="secondary" id="forgotPasswordBtn">Forgot Password?</button>' +
      '<button type="button" class="secondary" id="forgotUserIdBtn">Forgot User ID?</button>';
    card.appendChild(wrap);

    $('forgotPasswordBtn')?.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      window.mbizForgotPassword();
    });
    $('forgotUserIdBtn')?.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      window.mbizForgotUserId();
    });
    recoveryButtonsAdded = true;
  }

  function installLoginHandler() {
    if (loginHandlerInstalled) return;
    if (!$('authSubmit') || !$('authEmail') || !$('authPassword')) return;

    window.mbizLogin = async function (event) {
      if (event) event.preventDefault();

      const email = ($('authEmail')?.value || '').trim();
      const password = $('authPassword')?.value || '';
      const button = $('authSubmit');

      if (!email || !password) {
        if (!email) $('authEmail')?.focus();
        return false;
      }
      if (applyLockUI()) return false;
      if (!window.mbizSupabase?.auth?.signInWithPassword) {
        showError('Authentication service is unavailable. Please refresh the page.');
        return false;
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
        if (!applyLockUI()) setBusy(button, false);
      }
    };

    loginHandlerInstalled = true;
  }

  function init() {
    addRecoveryButtons();
    installLoginHandler();

    const email = $('authEmail');
    const password = $('authPassword');
    if (email && !email.dataset.mbizRecoveryBound) {
      email.addEventListener('input', applyLockUI);
      email.dataset.mbizRecoveryBound = '1';
    }
    if (password && !password.dataset.mbizRecoveryBound) {
      password.addEventListener('input', applyLockUI);
      password.dataset.mbizRecoveryBound = '1';
    }
    applyLockUI();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  window.setInterval(function () {
    init();
    applyLockUI();
  }, 1000);
})();
