const $ = id => document.getElementById(id);
const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
let reducedMotion = motionPreference.matches;
let updateTimer;
let welcomeTimer;
let welcomeFrame;
let discordLoadFrame;
let communityInviteTimer;
let discordLoadStartedAt;
let welcomeStartedAt;
let welcomeDuration;
let disposed = false;
let currentDiscordThemeId = null;
let discordThemeInitialized = false;
let communityInviteConfirmed = false;
let uiSoundsEnabled = true;
let uiAudioContext;

const welcomeSplash = $('welcome-splash');
const welcomeButton = $('skip-welcome');
const communityInviteDialog = $('community-invite-dialog');
const discordToolsMenu = $('discord-tools-menu');
const discordToolsButton = $('discord-tools-button');
const pluginsButton = $('discord-plugins-button');
const uiSoundToggle = $('ui-sound-toggle');
const themeChoices = [...document.querySelectorAll('[data-discord-theme]')];
const pageTargets = [...document.querySelectorAll('[data-page-target]')];
const pages = [...document.querySelectorAll('[data-page]')];
const cleanups = [];
const auroraBackdrop = $('aurora-backdrop');
const mascotHalo = document.querySelector('.mascot-halo');
let auroraPointerFrame;
let auroraPointerPosition;
let priorInviteFocus;
let previewAccessGranted = false;
let previewDialogPriorFocus = null;
let previewCheckBusy = false;
const inviteConfirmedPreference = window.brasilcord.getCommunityInviteConfirmed()
  .then(confirmed => (communityInviteConfirmed = confirmed, confirmed))
  .catch(() => false);

function applyLocalPluginTheme(plugin) {
  const root = document.documentElement;
  if (!plugin?.colors) {
    root.removeAttribute('data-local-plugin-theme');
    for (const name of ['--local-plugin-accent', '--local-plugin-highlight', '--local-plugin-surface']) {
      root.style.removeProperty(name);
    }
    return;
  }
  root.dataset.localPluginTheme = 'active';
  root.style.setProperty('--local-plugin-accent', plugin.colors.accent);
  root.style.setProperty('--local-plugin-highlight', plugin.colors.highlight);
  root.style.setProperty('--local-plugin-surface', plugin.colors.surface);
}

void window.brasilcord.getLocalPluginState()
  .then(state => applyLocalPluginTheme(state?.active))
  .catch(error => console.error('Não foi possível carregar o tema local:', error));
cleanups.push(window.brasilcord.onLocalPluginState(state => applyLocalPluginTheme(state?.active)));

function resetAuroraParallax() {
  cancelAnimationFrame(auroraPointerFrame);
  auroraPointerFrame = undefined;
  auroraPointerPosition = undefined;
  if (!auroraBackdrop) return;
  for (const key of ['--pointer-far-x', '--pointer-far-y', '--pointer-near-x', '--pointer-near-y']) {
    auroraBackdrop.style.setProperty(key, '0px');
  }
  mascotHalo?.style.setProperty('--pointer-mascot-x', '0px');
  mascotHalo?.style.setProperty('--pointer-mascot-y', '0px');
}

function syncAuroraState() {
  if (!auroraBackdrop) return;
  const homeVisible = document.body.classList.contains('home-page-active')
    && !document.body.classList.contains('discord-open');
  const covered = !welcomeSplash?.hidden || (communityInviteDialog && !communityInviteDialog.hidden);
  const paused = reducedMotion || document.hidden || !homeVisible || covered;
  auroraBackdrop.classList.toggle('is-paused', paused);
  if (paused) resetAuroraParallax();
}

function handleAuroraPointer(event) {
  if (!auroraBackdrop || reducedMotion || document.hidden
    || auroraBackdrop.classList.contains('is-paused')
    || !document.body.classList.contains('home-page-active')
    || document.body.classList.contains('discord-open')) return;
  auroraPointerPosition = {
    x: ((event.clientX / Math.max(window.innerWidth, 1)) - .5) * 22,
    y: ((event.clientY / Math.max(window.innerHeight, 1)) - .5) * 16
  };
  if (auroraPointerFrame) return;
  auroraPointerFrame = requestAnimationFrame(() => {
    auroraPointerFrame = undefined;
    if (!auroraPointerPosition || auroraBackdrop.classList.contains('is-paused')) return;
    const {x, y} = auroraPointerPosition;
    auroraBackdrop.style.setProperty('--pointer-far-x', `${(x * .32).toFixed(2)}px`);
    auroraBackdrop.style.setProperty('--pointer-far-y', `${(y * .32).toFixed(2)}px`);
    auroraBackdrop.style.setProperty('--pointer-near-x', `${(x * -.58).toFixed(2)}px`);
    auroraBackdrop.style.setProperty('--pointer-near-y', `${(y * -.58).toFixed(2)}px`);
    mascotHalo?.style.setProperty('--pointer-mascot-x', `${(x * -.2).toFixed(2)}px`);
    mascotHalo?.style.setProperty('--pointer-mascot-y', `${(y * -.2).toFixed(2)}px`);
  });
}

const handleVisibilityChange = () => syncAuroraState();
const handleMotionPreferenceChange = event => {
  reducedMotion = event.matches;
  syncAuroraState();
};
document.addEventListener('visibilitychange', handleVisibilityChange);
window.addEventListener('pointermove', handleAuroraPointer, {passive: true});
window.addEventListener('blur', resetAuroraParallax);
motionPreference.addEventListener('change', handleMotionPreferenceChange);
cleanups.push(() => document.removeEventListener('visibilitychange', handleVisibilityChange));
cleanups.push(() => window.removeEventListener('pointermove', handleAuroraPointer));
cleanups.push(() => window.removeEventListener('blur', resetAuroraParallax));
cleanups.push(() => motionPreference.removeEventListener('change', handleMotionPreferenceChange));

try {
  uiSoundsEnabled = localStorage.getItem('brasilcord-ui-sounds') !== 'false';
} catch {}

function updateUiSoundControl() {
  uiSoundToggle.setAttribute('aria-pressed', String(uiSoundsEnabled));
  uiSoundToggle.setAttribute('aria-label', `${uiSoundsEnabled ? 'Desativar' : 'Ativar'} sons da interface`);
  uiSoundToggle.title = `Sons da interface: ${uiSoundsEnabled ? 'ligados' : 'desligados'}`;
  $('ui-sound-label').textContent = uiSoundsEnabled ? 'Som ligado' : 'Som desligado';
}

function playUiSound(kind = 'click') {
  if (!uiSoundsEnabled || document.hidden) return;
  const AudioContextType = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextType) return;

  try {
    uiAudioContext ||= new AudioContextType();
    const context = uiAudioContext;
    const startTone = (frequency, endFrequency, startAt, duration, volume) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, startAt);
      oscillator.frequency.exponentialRampToValueAtTime(endFrequency, startAt + duration);
      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.exponentialRampToValueAtTime(volume, startAt + Math.min(0.012, duration / 3));
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(startAt);
      oscillator.stop(startAt + duration + 0.01);
      oscillator.addEventListener('ended', () => {
        oscillator.disconnect();
        gain.disconnect();
      }, {once: true});
    };

    const play = () => {
      const now = context.currentTime + 0.005;
      if (kind === 'success') {
        startTone(587, 720, now, 0.09, 0.035);
        startTone(784, 920, now + 0.08, 0.12, 0.028);
      } else if (kind === 'notice') {
        startTone(659, 560, now, 0.13, 0.025);
      } else {
        startTone(680, 520, now, 0.055, 0.022);
      }
    };

    if (context.state === 'suspended') void context.resume().then(play).catch(() => {});
    else play();
  } catch {}
}

updateUiSoundControl();
uiSoundToggle.addEventListener('click', () => {
  uiSoundsEnabled = !uiSoundsEnabled;
  try { localStorage.setItem('brasilcord-ui-sounds', String(uiSoundsEnabled)); } catch {}
  updateUiSoundControl();
  if (uiSoundsEnabled) playUiSound();
});

document.addEventListener('click', event => {
  const control = event.target.closest('button:not(#ui-sound-toggle), [data-page-target]');
  if (!control || control.disabled || control.getAttribute('aria-disabled') === 'true') return;
  playUiSound();
}, true);

function updateAppVersion() {
  window.brasilcord.getAppVersion().then(version => {
    if (version) $('app-version').textContent = `VERSÃO ${version}`;
  }).catch(() => {});
}
updateAppVersion();

function setPage(name, {focus = false, updateLocation = true} = {}) {
  // A pagina propria nao deve ser aberta por link, hash ou menu antes da verificacao local.
  if (name === 'app' && !previewAccessGranted) {
    openPreviewDialog();
    return false;
  }
  const page = pages.find(item => item.dataset.page === name);
  if (!page || document.body.classList.contains('discord-open')) return false;
  if (name !== 'app') previewAccessGranted = false;

  document.body.classList.toggle('bc-app-active', name === 'app');
  document.body.classList.toggle('home-page-active', name === 'inicio');
  syncAuroraState();

  pages.forEach(item => {
    const active = item === page;
    item.hidden = !active;
    item.classList.toggle('is-active', active);
    item.setAttribute('aria-hidden', String(!active));
  });

  pageTargets.forEach(target => {
    const active = target.dataset.pageTarget === name;
    target.classList.toggle('active', active);
    if (active && target.matches('button')) target.setAttribute('aria-current', 'page');
    else target.removeAttribute('aria-current');
  });

  if (updateLocation && window.location.hash !== `#${name}`) {
    history.replaceState(null, '', `#${name}`);
  }
  if (focus) page.querySelector('h1')?.focus({preventScroll: true});
  document.dispatchEvent(new CustomEvent('bc:page-changed',{detail:{name}}));
  return true;
}

pageTargets.forEach(target => {
  const activate = event => {
    event.preventDefault();
    setPage(target.dataset.pageTarget, {focus: true});
  };
  target.addEventListener('click', activate);
  cleanups.push(() => target.removeEventListener('click', activate));
});

const initialPage = window.location.hash.slice(1);
setPage(pages.some(page => page.dataset.page === initialPage && initialPage !== 'app') ? initialPage : 'inicio', {updateLocation: false});

async function showCommunityInvite() {
  if (!communityInviteDialog || disposed || !communityInviteDialog.hidden || document.body.classList.contains('discord-open')) return;
  if (await inviteConfirmedPreference || communityInviteConfirmed) return;
  if (disposed || document.body.classList.contains('discord-open')) return;
  priorInviteFocus = document.activeElement;
  communityInviteDialog.hidden = false;
  document.body.classList.add('community-dialog-open');
  syncAuroraState();
  if (uiAudioContext?.state === 'running') playUiSound('notice');
  $('community-invite-join').focus({preventScroll: true});
}

function closeCommunityInvite({restoreFocus = true} = {}) {
  if (!communityInviteDialog || communityInviteDialog.hidden) return;
  communityInviteDialog.hidden = true;
  document.body.classList.remove('community-dialog-open');
  syncAuroraState();
  if (restoreFocus && priorInviteFocus?.isConnected) priorInviteFocus.focus({preventScroll: true});
  priorInviteFocus = undefined;
}

async function confirmCommunityInvite() {
  try {
    const result = await window.brasilcord.setCommunityInviteConfirmed(true);
    if (result?.ok) {
      communityInviteConfirmed = true;
      playUiSound('success');
      closeCommunityInvite();
    }
    else $('community-invite-copy').textContent = 'Não consegui salvar a confirmação. Tente novamente.';
  } catch {
    $('community-invite-copy').textContent = 'Não consegui salvar a confirmação. Tente novamente.';
  }
}

$('community-invite-close').addEventListener('click', () => closeCommunityInvite());
$('community-invite-confirm').addEventListener('click', () => { void confirmCommunityInvite(); });
$('community-invite-join').addEventListener('click', () => openDiscord(
  () => window.brasilcord.joinOfficialServer(),
  'Abrindo o convite oficial do servidor dentro do Discord…'
));
communityInviteDialog.addEventListener('click', event => {
  if (event.target === communityInviteDialog || event.target.classList.contains('community-dialog-backdrop')) closeCommunityInvite();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !discordToolsMenu.hidden) {
    event.preventDefault();
    void setDiscordToolsMenu(false, {focus: true});
    return;
  }
  if (communityInviteDialog.hidden) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    closeCommunityInvite();
  } else if (event.key === 'Tab') {
    const focusable = [$('community-invite-close'), $('community-invite-join'), $('community-invite-confirm')];
    const current = focusable.indexOf(document.activeElement);
    if (event.shiftKey && current <= 0) {
      event.preventDefault();
      focusable.at(-1).focus();
    } else if (!event.shiftKey && current === focusable.length - 1) {
      event.preventDefault();
      focusable[0].focus();
    }
  }
});

function paintWelcomeProgress() {
  if (disposed || !welcomeSplash || welcomeSplash.hidden || welcomeSplash.dataset.dismissed) return;
  const progress = Math.min(100, ((performance.now() - welcomeStartedAt) / welcomeDuration) * 100);
  $('splash-progress-fill').style.width = `${progress}%`;
  $('splash-progress').setAttribute('aria-valuenow', String(Math.round(progress)));
  if (progress < 100) welcomeFrame = requestAnimationFrame(paintWelcomeProgress);
}

function closeWelcomeSplash({focus = true} = {}) {
  if (!welcomeSplash || welcomeSplash.hidden || welcomeSplash.dataset.dismissed) return;
  welcomeSplash.dataset.dismissed = 'true';
  clearTimeout(welcomeTimer);
  cancelAnimationFrame(welcomeFrame);
  $('splash-progress-fill').style.width = '100%';
  $('splash-progress').setAttribute('aria-valuenow', '100');
  $('splash-progress-label').textContent = 'Bem-vindo ao BrasilCord!';
  welcomeSplash.classList.add('is-leaving');
  welcomeTimer = setTimeout(() => {
    welcomeSplash.hidden = true;
    syncAuroraState();
    if (focus) $('open-discord')?.focus({preventScroll: true});
    void showCommunityInvite();
  }, reducedMotion ? 40 : 720);
}

if (welcomeSplash && welcomeButton) {
  welcomeButton.focus({preventScroll: true});
  welcomeButton.addEventListener('click', () => closeWelcomeSplash());
  welcomeDuration = reducedMotion ? 1100 : 4700;
  welcomeStartedAt = performance.now();
  welcomeFrame = requestAnimationFrame(paintWelcomeProgress);
  $('splash-progress-label').textContent = reducedMotion ? 'Preparando sua entrada…' : 'A natureza brasileira está chegando…';
  welcomeTimer = setTimeout(() => closeWelcomeSplash(), welcomeDuration);
}

function animateDiscordLoading() {
  if (!discordLoadStartedAt || disposed) return;
  const elapsed = performance.now() - discordLoadStartedAt;
  const progress = Math.min(92, 12 + elapsed / 38);
  $('discord-load-fill').style.width = `${progress}%`;
  $('discord-load-progress').setAttribute('aria-valuenow', String(Math.round(progress)));
  if (progress < 92) discordLoadFrame = requestAnimationFrame(animateDiscordLoading);
}

function finishDiscordLoading() {
  cancelAnimationFrame(discordLoadFrame);
  discordLoadFrame = undefined;
  discordLoadStartedAt = undefined;
  $('discord-load-fill').style.width = '100%';
  $('discord-load-progress').setAttribute('aria-valuenow', '100');
  clearTimeout(updateTimer);
  updateTimer = setTimeout(() => { $('discord-load-progress').hidden = true; }, reducedMotion ? 0 : 650);
}

function returnToHome(message) {
  cancelAnimationFrame(discordLoadFrame);
  discordLoadFrame = undefined;
  discordLoadStartedAt = undefined;
  $('discord-load-progress').hidden = true;
  $('discord-toolbar').hidden = true;
  setDiscordToolsMenu(false);
  document.body.classList.remove('discord-open');
  syncAuroraState();
  setPage('inicio');
  if (message) $('open-status').textContent = message;
  clearTimeout(communityInviteTimer);
  communityInviteTimer = setTimeout(() => { void showCommunityInvite(); }, reducedMotion ? 0 : 350);
}

cleanups.push(window.brasilcord.onDiscordLoad(status => {
  if (status.state === 'loading') {
    setDiscordToolsMenu(false);
    document.body.classList.add('discord-open');
    syncAuroraState();
    $('discord-toolbar').hidden = false;
    $('discord-load-progress').hidden = false;
    $('discord-load-fill').style.width = '12%';
    $('discord-load-progress').setAttribute('aria-valuenow', '12');
    discordLoadStartedAt = performance.now();
    cancelAnimationFrame(discordLoadFrame);
    discordLoadFrame = requestAnimationFrame(animateDiscordLoading);
  } else if (status.state === 'loaded') {
    finishDiscordLoading();
  } else if (status.state === 'failed') {
    returnToHome(status.message || 'Não foi possível carregar o Discord. Confira sua conexão e tente novamente.');
  } else if (status.state === 'closed') {
    returnToHome();
    $('open-status').textContent = '';
  }
}));

cleanups.push(window.brasilcord.onUpdateStatus(update => {
  const toast = $('update-toast');
  const fill = $('update-progress-fill');
  toast.hidden = false;
  toast.dataset.state = update.status;
  $('update-message').textContent = update.message;
  fill.style.width = update.percent == null
    ? (update.status === 'ready' ? '100%' : '0%')
    : `${Math.max(0, Math.min(100, update.percent))}%`;
  clearTimeout(updateTimer);
  if (update.status === 'ready') updateTimer = setTimeout(() => { toast.hidden = true; }, 15000);
  if (update.status === 'current' || update.status === 'error') updateTimer = setTimeout(() => { toast.hidden = true; }, 11000);
}));

cleanups.push(window.brasilcord.onDiscordTheme(theme => {
  discordThemeInitialized = true;
  currentDiscordThemeId = theme.id || null;
  $('discord-theme-status').textContent = theme.name ? `Cor: ${theme.name}` : 'Cor original';
  $('discord-theme-status').dataset.state = 'success';
  themeChoices.forEach(choice => choice.setAttribute('aria-pressed', String(choice.dataset.discordTheme === theme.id)));
  $('discord-theme-reset').setAttribute('aria-pressed', String(!theme.id));
}));

function setDiscordToolsMenu(open, {focus = false} = {}) {
  discordToolsMenu.hidden = !open;
  discordToolsButton.setAttribute('aria-expanded', String(open));
  if (focus && !open) discordToolsButton.focus({preventScroll: true});
  if (focus && open) (themeChoices.find(choice => choice.getAttribute('aria-pressed') === 'true') || themeChoices[0])?.focus();
  return window.brasilcord.setDiscordToolsMenu(open).then(result => {
    if (result?.ok || !open) return result;
    discordToolsMenu.hidden = true;
    discordToolsButton.setAttribute('aria-expanded', 'false');
    return result;
  }).catch(error => {
    console.error('Não foi possível ajustar a área do menu Tools:', error);
    discordToolsMenu.hidden = true;
    discordToolsButton.setAttribute('aria-expanded', 'false');
    return {ok: false};
  });
}

async function applyDiscordTheme(themeId) {
  discordThemeInitialized = true;
  const selectedChoice = themeChoices.find(choice => choice.dataset.discordTheme === themeId);
  const selectedName = selectedChoice?.textContent.trim() || 'original';
  $('discord-theme-status').textContent = themeId ? `Aplicando: ${selectedName}` : 'Restaurando a cor original…';
  $('discord-theme-status').dataset.state = 'loading';
  discordToolsMenu.setAttribute('aria-busy', 'true');
  themeChoices.forEach(choice => { choice.disabled = true; });
  $('discord-theme-reset').disabled = true;
  try {
    const result = await window.brasilcord.setDiscordTheme(themeId);
    if (result?.ok) {
      currentDiscordThemeId = result.id || null;
      $('discord-theme-status').textContent = result.deferred && result.name
        ? `${result.name} salva. Será aplicada ao abrir o Discord.`
        : result.name ? `Cor: ${result.name}` : 'Cor original';
      $('discord-theme-status').dataset.state = 'success';
      return;
    }
    $('discord-theme-status').textContent = result?.message || 'Não foi possível aplicar essa cor.';
    $('discord-theme-status').dataset.state = 'error';
  } catch (error) {
    console.error('Falha ao trocar a cor do Discord:', error);
    $('discord-theme-status').textContent = `Não foi possível aplicar essa cor${error?.message ? `: ${error.message}` : '. Tente novamente.'}`;
    $('discord-theme-status').dataset.state = 'error';
  } finally {
    discordToolsMenu.removeAttribute('aria-busy');
    themeChoices.forEach(choice => { choice.disabled = false; });
    $('discord-theme-reset').disabled = false;
    themeChoices.forEach(choice => choice.setAttribute('aria-pressed', String(choice.dataset.discordTheme === currentDiscordThemeId)));
    $('discord-theme-reset').setAttribute('aria-pressed', String(!currentDiscordThemeId));
  }
}

void window.brasilcord.getDiscordTheme().then(theme => {
  if (discordThemeInitialized) return;
  discordThemeInitialized = true;
  currentDiscordThemeId = theme?.id || null;
  themeChoices.forEach(choice => choice.setAttribute('aria-pressed', String(choice.dataset.discordTheme === currentDiscordThemeId)));
  $('discord-theme-reset').setAttribute('aria-pressed', String(!currentDiscordThemeId));
  $('discord-theme-status').textContent = theme?.name ? `Cor: ${theme.name}` : 'Cor original';
}).catch(error => console.error('Não foi possível ler a cor salva:', error));

discordToolsButton.addEventListener('click', () => {
  const opening = discordToolsMenu.hidden;
  void setDiscordToolsMenu(opening, {focus: opening});
});
document.addEventListener('pointerdown', event => {
  if (discordToolsMenu.hidden || discordToolsMenu.contains(event.target) || discordToolsButton.contains(event.target)) return;
  void setDiscordToolsMenu(false);
});
pluginsButton.addEventListener('click', async () => {
  await setDiscordToolsMenu(false);
  try {
    const result = await window.brasilcord.openPluginsManager();
    if (!result?.ok && result?.message) $('open-status').textContent = result.message;
  } catch (error) {
    console.error('Não foi possível abrir o gerenciador de plugins:', error);
    $('open-status').textContent = 'Não foi possível abrir o gerenciador de plugins.';
  }
});
themeChoices.forEach(choice => choice.addEventListener('click', () => { void applyDiscordTheme(choice.dataset.discordTheme); }));
$('discord-theme-reset').addEventListener('click', () => { void applyDiscordTheme(null); });

async function updateZoomDisplay(result) {
  if (!result?.ok) return;
  $('discord-zoom-level').value = `${Math.round(result.factor * 100)}%`;
  $('discord-zoom-level').textContent = $('discord-zoom-level').value;
}

async function openDiscord(openAction, statusMessage) {
  const status = $('open-status');
  if (status) status.textContent = statusMessage;
  closeCommunityInvite({restoreFocus: false});
  closeWelcomeSplash({focus: false});
  document.body.classList.add('discord-open');
  syncAuroraState();
  $('discord-toolbar').hidden = false;
  try {
    const result = await openAction();
    if (!result.ok) returnToHome(result.message);
    else updateZoomDisplay(await window.brasilcord.getDiscordZoom());
  } catch {
    returnToHome('Não consegui carregar o Discord oficial. Confira sua conexão e tente novamente.');
  }
}

// A senha e uma barreira visual de teste, nunca uma credencial administrativa real.
const previewDialog = $('bc-preview-dialog');
const previewForm = $('bc-preview-form');
const previewPassword = $('bc-preview-password');
const previewError = $('bc-preview-error');
const previewSubmit = $('bc-preview-submit');

function openPreviewDialog() {
  if (!previewDialog.hidden) return;
  previewDialogPriorFocus = document.activeElement;
  previewPassword.value = '';
  previewError.textContent = '';
  previewDialog.hidden = false;
  document.body.classList.add('bc-preview-open');
  previewPassword.focus({preventScroll: true});
}

function closePreviewDialog({restoreFocus = true} = {}) {
  if (previewCheckBusy || previewDialog.hidden) return;
  previewDialog.hidden = true;
  document.body.classList.remove('bc-preview-open');
  previewPassword.value = '';
  previewError.textContent = '';
  if (restoreFocus) (previewDialogPriorFocus?.isConnected ? previewDialogPriorFocus : $('enter-brasilcord')).focus({preventScroll: true});
  previewDialogPriorFocus = null;
}
$('bc-preview-close').addEventListener('click', () => closePreviewDialog());
previewDialog.querySelector('.bc-preview-backdrop').addEventListener('click', () => closePreviewDialog());
previewDialog.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    event.preventDefault();
    closePreviewDialog();
    return;
  }
  if (event.key !== 'Tab') return;
  const focusable = [...previewDialog.querySelectorAll('button:not([disabled]), input:not([disabled])')];
  if (!focusable.length) return;
  if (event.shiftKey && document.activeElement === focusable[0]) {
    event.preventDefault();
    focusable.at(-1).focus();
  } else if (!event.shiftKey && document.activeElement === focusable.at(-1)) {
    event.preventDefault();
    focusable[0].focus();
  }
});
previewForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (previewCheckBusy) return;
  previewCheckBusy = true;
  previewSubmit.disabled = true;
  previewError.textContent = '';
  try {
    const result = await window.brasilcord.verifyPreviewAccess(previewPassword.value);
    previewPassword.value = '';
    if (!result?.ok) {
      previewError.textContent = result?.message || 'Senha incorreta.';
      previewPassword.focus({preventScroll: true});
      return;
    }
    previewAccessGranted = true;
    previewDialog.hidden = true;
    document.body.classList.remove('bc-preview-open');
    previewDialogPriorFocus = null;
    setPage('app', {focus: true});
  } catch (error) {
    previewPassword.value = '';
    previewError.textContent = 'Nao foi possivel validar a senha. Tente novamente.';
  } finally {
    previewCheckBusy = false;
    previewSubmit.disabled = false;
  }
});

$('enter-brasilcord').addEventListener('click', openPreviewDialog);
$('bc-workspace-back').addEventListener('click', () => setPage('inicio', {focus: true}));
$('bc-open-discord').addEventListener('click', () => openDiscord(
  () => window.brasilcord.openDiscord(),
  'Carregando o Discord oficial…'
));
$('bc-open-community').addEventListener('click', () => openDiscord(
  () => window.brasilcord.joinOfficialServer(),
  'Abrindo o convite da comunidade oficial…'
));
$('bc-check-update').addEventListener('click', async event => {
  const button = event.currentTarget;
  const status = $('bc-workspace-status');
  button.disabled = true;
  status.textContent = 'Consultando as atualizações…';
  try {
    const result = await window.brasilcord.checkForUpdates();
    if (!result?.ok) status.textContent = result?.message || 'Não foi possível verificar as atualizações.';
    else status.textContent = 'Consulta iniciada. Confira o aviso de atualização.';
  } catch (error) {
    console.error('Falha na verificação manual:', error);
    status.textContent = 'Falha ao verificar atualizações.';
  } finally {
    button.disabled = false;
  }
});

$('open-discord').addEventListener('click', () => openDiscord(
  () => window.brasilcord.openDiscord(),
  'Carregando a página oficial do Discord nesta janela…'
));

$('join-official-server').addEventListener('click', () => openDiscord(
  () => window.brasilcord.joinOfficialServer(),
  'Abrindo o convite oficial do servidor dentro do Discord…'
));

const openOfficialServer = () => openDiscord(
  () => window.brasilcord.joinOfficialServer(),
  'Abrindo o convite oficial do servidor dentro do Discord…'
);
$('about-open-discord').addEventListener('click', () => openDiscord(
  () => window.brasilcord.openDiscord(),
  'Carregando a página oficial do Discord nesta janela…'
));
$('partners-open-discord').addEventListener('click', openOfficialServer);
$('creator-community-discord').addEventListener('click', openOfficialServer);
$('top-community-discord').addEventListener('click', openOfficialServer);

document.querySelectorAll('[data-social-link]:not(:disabled)').forEach(button => {
  button.addEventListener('click', async () => {
    try {
      const result = await window.brasilcord.openSocialLink(button.dataset.socialLink);
      if (!result?.ok) $('open-status').textContent = result?.message || 'Não foi possível abrir este link.';
    } catch (error) {
      console.error('Falha ao abrir link social:', error);
      $('open-status').textContent = 'Não foi possível abrir este link. Tente novamente.';
    }
  });
});

$('discord-zoom-out').addEventListener('click', async () => updateZoomDisplay(await window.brasilcord.adjustDiscordZoom(-1)));
$('discord-zoom-in').addEventListener('click', async () => updateZoomDisplay(await window.brasilcord.adjustDiscordZoom(1)));
$('discord-zoom-reset').addEventListener('click', async () => updateZoomDisplay(await window.brasilcord.resetDiscordZoom()));
async function openBrasilCordStream(source, button) {
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  try {
    const result = await window.brasilcord.openStream(source);
    if (!result?.ok && result?.message) $('open-status').textContent = result.message;
  } catch (error) {
    console.error('Não foi possível abrir a transmissão do BrasilCord:', error);
    $('open-status').textContent = 'Não foi possível abrir a janela de transmissão.';
  } finally {
    button.disabled = false;
    button.removeAttribute('aria-busy');
  }
}
$('stream-share-screen').addEventListener('click', event => openBrasilCordStream('screen', event.currentTarget));
$('stream-share-camera').addEventListener('click', event => openBrasilCordStream('camera', event.currentTarget));
$('return-home').addEventListener('click', async () => {
  await setDiscordToolsMenu(false);
  try {
    await window.brasilcord.returnHome();
  } finally {
    returnToHome();
    $('open-status').textContent = '';
  }
});

document.addEventListener('error', event => {
  const image = event.target;
  if (!(image instanceof HTMLImageElement)) return;
  image.classList.add('image-unavailable');
  image.parentElement?.classList.add('image-fallback');
}, true);

window.addEventListener('pagehide', () => {
  disposed = true;
  clearTimeout(updateTimer);
  clearTimeout(welcomeTimer);
  cancelAnimationFrame(welcomeFrame);
  cancelAnimationFrame(discordLoadFrame);
  cleanups.forEach(cleanup => cleanup?.());
}, {once: true});
