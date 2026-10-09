/* M.BizAccount admin recovery + login lockout */
(function () {
  'use strict';

  const LOCK_KEY = 'mbizaccount_login_lockouts_v6';
  const MAX_BACKOFF_MINUTES = 60;
  let initialized = false;
  const $ = (id) => document.getElementById(id);
  const normalize = (v) => String(v || '').trim().toLowerCase();

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

  function formatRemaining(ms) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    return Math.floor(total / 60) + 'm ' +
      String(total % 60).padStart(2, '0') + 's';
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
    }
  }

  function clearError() {
    const box = $('authError');
    if (box) box.style.display = 'none';
  }

  function registerFailure(email) {
    const key = normalize(email);
    if (!key) return { minutes: 0 };

    const state = readState();
    const entry = state[key] || { fails: 0, lockedUntil: 0 };
    entry.fails = (entry.fails || 0) + 1;

    const minutes = entry.fails >= 5
      ? Math.min(MAX_BACKOFF_MINUTES, entry.fails - 4)
      : 0;

    entry.lockedUntil = minutes
      ? Date.now() + minutes * 60000
      : 0;

    state[key] = entry;
    saveState(state);
    return { minutes };
  }

  function clearFailures(email) {
    const state = readState();
    const key = normalize(email);
    if (key) delete state[key];
    saveState(state);
  }

  function applyLockUI() {
    const button = $('authSubmit');
    const email = $('authEmail')?.value || '';
    if (!button) return false;

    const entry = getEntry(email);

    if (entry.lockedUntil > Date.now()) {
      button.disabled = true;
      button.textContent =
        'Locked ' + formatRemaining(entry.lockedUntil - Date.now());
      setStatus(
        'Too many failed attempts. Try again in ' +
        formatRemaining(entry.lockedUntil - Date.now()) + '.'
      );
      return true;
    }

    if (button.textContent.indexOf('Locked ') === 0) {
      button.disabled = false;
      button.textContent = 'Sign In';
    }

    return false;
  }

  async function waitForSupabase(timeoutMs = 5000) {
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      if (window.mbizSupabase?.auth) return window.mbizSupabase;
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return null;
  }

  /* REAL PASSWORD RECOVERY */
  async function forgotPassword() {
    const email = ($('authEmail')?.value || '').trim();

    if (!email) {
      clearError();
      showError('Enter your registered admin email first.');
      setStatus('Enter your admin email, then tap Forgot Password.');
      $('authEmail')?.focus();
      return;
    }

    const button = $('forgotPasswordBtn');

    if (button) {
      button.disabled = true;
      button.textContent = 'Sending...';
    }

    clearError();
    setStatus('Sending password recovery email...');

    try {
      const client = await waitForSupabase();

      if (!client?.auth?.resetPasswordForEmail) {
        throw new Error('Supabase Auth unavailable');
      }

      const redirectTo =
        window.location.origin + window.location.pathname;

      const { error } =
        await client.auth.resetPasswordForEmail(email, {
          redirectTo
        });

      if (error) throw error;

      setStatus(
        'Recovery email sent. Open the link in your email to create a new password.'
      );

      clearError();

    } catch (error) {
      console.error('Password recovery failed:', error);

      showError(
        error?.message ||
        'Password recovery failed. Check the email and try again.'
      );

      setStatus('Password recovery failed.');

    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = 'Forgot Password?';
      }
    }
  }

  /* USER ID = REGISTERED SUPABASE EMAIL */
  function forgotUserId() {
    clearError();

    setStatus(
      'Your User ID is the admin email address registered in Supabase. ' +
      'Enter that email in the User ID / Email field.'
    );

    $('authEmail')?.focus();
  }

  /* PASSWORD RESET SCREEN */
  function createPasswordResetScreen() {
    if ($('passwordResetPanel')) return;

    const panel = document.createElement('div');
    panel.id = 'passwordResetPanel';

    panel.style.cssText =
      'position:fixed;inset:0;z-index:100001;' +
      'display:none;align-items:center;justify-content:center;' +
      'padding:18px;background:#0f172aef';

    panel.innerHTML = `
      <div style="width:min(390px,100%);background:#fff;border-radius:14px;padding:24px;box-shadow:0 20px 60px #0007">
        <h2 style="margin:0 0 6px;font:26px Georgia;color:var(--green,#166534)">
          Reset Password
        </h2>

        <p style="margin:0 0 18px;color:#64748b">
          Create a new password for your admin account.
        </p>

        <div style="margin-bottom:12px">
          <label>New Password</label>
          <input id="newRecoveryPassword"
            type="password"
            autocomplete="new-password"
            minlength="6"
            placeholder="New password"
            style="width:100%;box-sizing:border-box">
        </div>

        <div style="margin-bottom:12px">
          <label>Confirm Password</label>
          <input id="confirmRecoveryPassword"
            type="password"
            autocomplete="new-password"
            minlength="6"
            placeholder="Confirm password"
            style="width:100%;box-sizing:border-box">
        </div>

        <div id="recoveryPasswordError"
          style="display:none;color:#a33d3d;background:#fdecec;border:1px solid #e4b7b7;padding:8px;border-radius:7px;margin:10px 0;font-size:12px">
        </div>

        <button id="updateRecoveryPassword"
          type="button"
          class="primary"
          style="width:100%">
          Update Password
        </button>

        <button id="cancelRecoveryPassword"
          type="button"
          class="secondary"
          style="width:100%;margin-top:8px">
          Back to Sign In
        </button>
      </div>
    `;

    document.body.appendChild(panel);

    $('cancelRecoveryPassword').addEventListener('click', () => {
      panel.style.display = 'none';
    });

    $('updateRecoveryPassword').addEventListener('click', async () => {
      const password = $('newRecoveryPassword').value;
      const confirm = $('confirmRecoveryPassword').value;
      const errorBox = $('recoveryPasswordError');
      const button = $('updateRecoveryPassword');

      errorBox.style.display = 'none';

      if (!password || password.length < 6) {
        errorBox.textContent =
          'Password must be at least 6 characters.';
        errorBox.style.display = '';
        return;
      }

      if (password !== confirm) {
        errorBox.textContent =
          'Passwords do not match.';
        errorBox.style.display = '';
        return;
      }

      button.disabled = true;
      button.textContent = 'Updating...';

      try {
        const client = await waitForSupabase();

        if (!client?.auth?.updateUser) {
          throw new Error('Supabase Auth unavailable');
        }

        const { error } =
          await client.auth.updateUser({
            password
          });

        if (error) throw error;

        panel.innerHTML = `
          <div style="width:min(390px,100%);background:#fff;border-radius:14px;padding:24px;text-align:center">
            <h2>Password Updated</h2>
            <p>Your admin password has been changed successfully.</p>
            <button id="recoveryDone"
              class="primary"
              style="width:100%">
              Go to Sign In
            </button>
          </div>
        `;

        $('recoveryDone').addEventListener('click', () => {
          window.location.href =
            window.location.origin + window.location.pathname;
        });

      } catch (error) {
        console.error('Password update failed:', error);

        errorBox.textContent =
          error?.message ||
          'Password could not be updated.';
        errorBox.style.display = '';

        button.disabled = false;
        button.textContent = 'Update Password';
      }
    });
  }

  function checkRecoverySession() {
    createPasswordResetScreen();

    const hash = window.location.hash || '';

    if (
      hash.includes('type=recovery') ||
      hash.includes('access_token=')
    ) {
      setTimeout(() => {
        const panel = $('passwordResetPanel');
        if (panel) panel.style.display = 'flex';
      }, 300);
    }
  }

  function addRecoveryButtons() {
    const card = document.querySelector('.auth-card');
    if (!card) return false;
    if ($('authRecovery')) return true;

    const wrap = document.createElement('div');
    wrap.id = 'authRecovery';

    wrap.style.cssText =
      'display:flex;justify-content:center;gap:10px;' +
      'flex-wrap:wrap;margin-top:13px';

    const passwordBtn = document.createElement('button');
    passwordBtn.type = 'button';
    passwordBtn.className = 'secondary';
    passwordBtn.id = 'forgotPasswordBtn';
    passwordBtn.textContent = 'Forgot Password?';

    passwordBtn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      forgotPassword();
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

    if (!emailInput || !passwordInput || !submitButton) {
      return false;
    }

    window.mbizLogin = async function(event) {
      if (event) event.preventDefault();

      const email = emailInput.value.trim();
      const password = passwordInput.value || '';

      if (!email) {
        emailInput.focus();
        return false;
      }

      if (!password) {
        passwordInput.focus();
        return false;
      }

      if (applyLockUI()) return false;

      clearError();
      submitButton.disabled = true;
      submitButton.textContent = 'Signing in...';
      setStatus('Checking your account...');

      try {
        const client = await waitForSupabase();

        if (!client?.auth?.signInWithPassword) {
          throw new Error('Authentication service unavailable');
        }

        const { error } =
          await client.auth.signInWithPassword({
            email,
            password
          });

        if (error) throw error;

        clearFailures(email);
        setStatus('Signed in.');
        return true;

      } catch (error) {
        console.error('Sign in failed:', error);

        const result = registerFailure(email);

        if (result.minutes > 0) {
          showError(
            'Too many failed attempts. This User ID is locked for ' +
            result.minutes + ' minute' +
            (result.minutes === 1 ? '' : 's') + '.'
          );
          setStatus('Login temporarily locked.');
        } else {
          showError(
            'Sign in failed. Please check your User ID and password.'
          );
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
    checkRecoverySession();
    applyLockUI();
  }

  window.mbizForgotPassword = forgotPassword;
  window.mbizForgotUserId = forgotUserId;
  window.mbizAuthApplyLockUI = applyLockUI;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  setInterval(init, 1000);
})();
