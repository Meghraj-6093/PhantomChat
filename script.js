import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// SUPABASE CONFIG 
const SUPABASE_URL  = "https://tkrwcalqyikxjrxzppos.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrcndjYWxxeWlreGpyeHpwcG9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3MzAyOTAsImV4cCI6MjA5ODMwNjI5MH0.2NfQAJrVUkYgk-dBVbFzI3nIqwsnwvT5XSoH3Wk_jtc";
// ─────────────────────────────────────────────────────────────

const sb     = createClient(SUPABASE_URL, SUPABASE_ANON);
const BUCKET = 'phantom-media';

// Constants
const EMOJIS  = ['😀','😃','😄','😅','😂','🤣','😊','😎','🤩','😘','🥲','😜','🤪','🤔','🤨','😏','😒','🙄','😬','😴','😵','😈','💀','👻','🤖','💩','😺','👍','👎','👏','🙌','🙏','💪','❤️','🧡','💛','💚','💙','💜','💔','🔥','🌟','✨','💫','💥','💯','⭐','🎉','🏆','👀','💬','⚡','🚀'];
const COLORS  = ['#5b6fff','#a855f7','#ec4899','#f59e0b','#22c55e','#06b6d4'];
const STORY_COLORS = ['#5b6fff','#a855f7','#ec4899','#f59e0b','#22c55e','#06b6d4','#ef4444','#0ea5e9','#84cc16','#f97316'];
const WALLPAPERS = [
  {id:'none',style:'background:var(--bg2)'},
  {id:'dots',style:'background-image:radial-gradient(circle,var(--border2) 1px,transparent 1px);background-size:20px 20px;background-color:var(--bg)'},
  {id:'waves',style:'background:linear-gradient(135deg,#0b0d14 0%,#1a1040 50%,#0b0d14 100%)'},
  {id:'aurora',style:'background:linear-gradient(135deg,#0b0d14,#0d1b2a,#162032,#1a2038)'},
  {id:'sunset',style:'background:linear-gradient(160deg,#1a0533,#3b0764,#0d1117)'},
  {id:'forest',style:'background:linear-gradient(160deg,#0a1628,#022c22,#0a1628)'},
  {id:'rose',style:'background:linear-gradient(160deg,#1a0010,#3d0020,#1a0010)'},
  {id:'sky',style:'background:linear-gradient(180deg,#0a1628,#1e3a8a,#0a1628)'},
];

// State
let me = null, myData = {};
let currentChat = null;
let replyTarget = null, contextTarget = null, editingMsgId = null;
let typingTimer = null, emojiOpen = false, isSending = false;
let selectedAv = '?', groupMemberIds = [];
let chatSubs = [], rtSubs = [];
let mediaRecorder = null, audioChunks = [], recInterval = null, recSeconds = 0;
let isRecording = false;
let currentStories = [], storyIndex = 0, storyTimer = null;
let msgSearchResults = [], msgSearchIdx = 0;
let chatWallpaper = '';
let disappearSeconds = 0;
let pending2FAUser = null;
let notifSound = true;

// ── DOM ───────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const mk = (tag, cls='', html='') => { const e = document.createElement(tag); e.className = cls; e.innerHTML = html; return e; };

//  SPLASH → BOOT
window.addEventListener('DOMContentLoaded', () => {
  // Initialize theme immediately
  setTheme(localStorage.getItem('phantom_theme')||'light');

  // Show splash for 1.8s then check auth
  setTimeout(async () => {
    $('splash-screen').style.opacity = '0';
    $('splash-screen').style.transition = 'opacity .4s';
    setTimeout(() => $('splash-screen').style.display = 'none', 400);

    const { data: { session } } = await sb.auth.getSession();
    if (session?.user) { me = session.user; await boot(); }
    else showAuth();

    sb.auth.onAuthStateChange(async (_evt, session) => {
      if (session?.user && !me) { me = session.user; await boot(); }
      else if (!session?.user && me) { me = null; showAuth(); }
    });
  }, 1900);

  wireUI();
  if (window.lucide) lucide.createIcons();
});

async function boot() {
  await ensureProfile();
  const ud = await getMyData();
  if (ud.two_fa_enabled) {
    show2FA();
    return;
  }
  showApp();
}

function showApp() {
  const tfaEl = $('tfa-screen'); if (tfaEl) tfaEl.style.display = 'none';
  $('auth-screen').style.display = 'none';
  $('app').style.display = 'flex';
  
  // PWA Service Worker Registration
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').then(reg => {
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            window.location.reload();
          }
        });
      });
    }).catch(err => console.log('PWA Service Worker Registration Failed:', err));
  }

  loadMyProfile().then(() => {
    if (myData.role === 'owner' || myData.role === 'admin' || myData.role === 'moderator') {
      if ($('nav-btn-admin')) $('nav-btn-admin').style.display = 'flex';
      if ($('btn-admin-dashboard')) $('btn-admin-dashboard').style.display = 'block';
    } else {
      if ($('nav-btn-admin')) $('nav-btn-admin').style.display = 'none';
      if ($('btn-admin-dashboard')) $('btn-admin-dashboard').style.display = 'none';
    }
  });
  loadDMList();
  loadFriendRequests();
  loadFriendsList();
  loadRooms();
  loadGroups();
  loadStories();
  subscribePresence();
  subscribeToFriendRequests();
  setTimeout(loadSuggestedUsers, 700);
  startDisappearChecker();
  loadSettings();
  setupMobile();
  setupMentions();
  setupAdminDashboard();
  setupHashtagsSearch();
  setupAnnouncements();
  
  // Default routing to feed panel
  switchFeedOrChat('feed');
  if (window.lucide) lucide.createIcons();
}
function showAuth() {
  $('auth-screen').style.display = 'flex';
  $('app').style.display = 'none';
  if (window.lucide) lucide.createIcons();
}

//  WIRE UI
function wireUI() {
  // Auth Theme Toggler
  if ($('auth-theme-btn')) $('auth-theme-btn').onclick = toggleTheme;

  // Auth
  $('tab-login').onclick = () => showTab('login');
  $('tab-register').onclick = () => showTab('register');
  $('btn-login-email').onclick = loginEmail;
  $('btn-register-email').onclick = registerEmail;
  $('btn-google-login').onclick = loginGoogle;
  $('toggle-login-pw').onclick = () => togglePw('login-password', $('toggle-login-pw'));
  $('toggle-reg-pw').onclick   = () => togglePw('reg-password',   $('toggle-reg-pw'));
  $('login-password').addEventListener('keydown', e => { if (e.key==='Enter') loginEmail(); });
  $('reg-password').addEventListener('keydown',   e => { if (e.key==='Enter') registerEmail(); });

  // Registration avatar photo upload
  if ($('btn-reg-avatar-upload')) $('btn-reg-avatar-upload').onclick = () => $('reg-avatar-upload').click();
  if ($('reg-avatar-preview')) $('reg-avatar-preview').onclick = () => $('reg-avatar-upload').click();
  if ($('reg-avatar-upload')) {
    $('reg-avatar-upload').onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) { toast('Max image size is 5 MB'); e.target.value = ''; return; }
      const reader = new FileReader();
      reader.onload = (ev) => {
        selectedAv = ev.target.result; // Save base64 string
        renderAv($('reg-avatar-preview'), selectedAv);
      };
      reader.readAsDataURL(file);
    };
  }

  // Profile avatar photo upload
  if ($('btn-profile-avatar-upload')) $('btn-profile-avatar-upload').onclick = () => $('profile-avatar-upload').click();
  if ($('profile-avatar-big')) $('profile-avatar-big').onclick = () => $('profile-avatar-upload').click();
  if ($('profile-avatar-upload')) {
    $('profile-avatar-upload').onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) { toast('Max image size is 5 MB'); e.target.value = ''; return; }
      toast('Uploading photo...');
      try {
        const ext = file.name.split('.').pop().toLowerCase() || 'png';
        const path = `avatars/${me.id}_${Date.now()}.${ext}`;
        const { error: upErr } = await sb.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: true });
        if (upErr) throw upErr;
        const { data: { publicUrl } } = sb.storage.from(BUCKET).getPublicUrl(path);
        selectedAv = publicUrl;
        renderAv($('profile-avatar-big'), selectedAv);
        await sb.from('users').update({ avatar: selectedAv }).eq('id', me.id);
        loadMyProfile();
        toast('Photo uploaded ✓');
      } catch (err) {
        console.error(err);
        toast('Upload failed: ' + err.message);
      }
    };
  }

  // 2FA
  if ($('btn-verify-otp')) $('btn-verify-otp').onclick = verify2FA;
  if ($('btn-resend-otp')) $('btn-resend-otp').onclick = showBackupInput;
  wire2FAInputs();

  // App
  if ($('logout-btn')) $('logout-btn').onclick = logout;
  if ($('theme-btn')) $('theme-btn').onclick  = toggleTheme;
  if ($('my-avatar-wrap')) $('my-avatar-wrap').onclick = () => openModal('profile-modal');
  if ($('btn-settings')) $('btn-settings').onclick = () => openModal('profile-modal');

  // Vertical Navigation Bar Links (Instagram style sidebar)
  document.querySelectorAll('.nav-sidebar .nav-item').forEach(b => {
    b.onclick = () => {
      const panel = b.dataset.panel;
      if (panel) {
        switchFeedOrChat(panel);
      } else if (b.id === 'nav-btn-profile') {
        openModal('profile-modal');
      } else if (b.id === 'nav-btn-theme') {
        toggleTheme();
      }
    };
  });

  // Pinned Bottom Profile Card Click Handlers
  const profBlock = $('nav-profile-block');
  if (profBlock) {
    const av = profBlock.querySelector('.avatar');
    const det = profBlock.querySelector('.nav-profile-details');
    const out = profBlock.querySelector('.nav-profile-logout');
    if (av) av.onclick = () => openModal('profile-modal');
    if (det) det.onclick = () => openModal('profile-modal');
    if (out) out.onclick = logout;
  }

  // Mobile Bottom Navigation
  document.querySelectorAll('.mob-bottom-nav .mbn-btn').forEach(b => {
    b.onclick = () => {
      const panel = b.dataset.panel;
      if (panel) {
        switchFeedOrChat(panel);
      } else if (b.id === 'mbn-create') {
        openModal('story-modal');
      } else if (b.id === 'mbn-profile') {
        openModal('profile-modal');
      }
    };
  });

  // Feed Actions
  if ($('post-img-upload')) {
    $('post-img-upload').addEventListener('change', e => {
      const file = e.target.files[0];
      $('post-img-filename').textContent = file ? file.name : '';
    });
  }
  if ($('btn-submit-post')) $('btn-submit-post').onclick = submitFeedPost;
  if ($('feed-btn-add-story')) $('feed-btn-add-story').onclick = () => openModal('story-modal');

  // Search
  let dsd; $('dm-search').addEventListener('input', e => { clearTimeout(dsd); dsd = setTimeout(() => searchDmUsers(e.target.value.trim()), 280); });
  let fsd; $('friend-search').addEventListener('input', e => { clearTimeout(fsd); fsd = setTimeout(() => searchFriendUsers(e.target.value.trim()), 280); });
  let gmd; setTimeout(() => {
    const g = $('gm-search'); if (g) g.addEventListener('input', e => { clearTimeout(gmd); gmd = setTimeout(() => loadGroupUserList(e.target.value.trim()), 250); });
  }, 200);

  // Rooms/Groups
  $('btn-create-room').onclick  = () => openModal('create-room-modal');
  $('btn-create-group').onclick = openCreateGroupModal;
  $('btn-close-room').onclick   = () => closeModal('create-room-modal');
  $('btn-close-group').onclick  = () => closeModal('create-group-modal');
  $('btn-confirm-room').onclick  = createRoom;
  $('btn-confirm-group').onclick = createGroup;

  // Chat
  $('mob-back-btn').onclick    = closeChat;
  $('btn-info').onclick        = toggleInfo;
  $('btn-close-info').onclick  = toggleInfo;
  $('btn-msg-search').onclick  = toggleMsgSearch;
  if ($('btn-close-msg-search')) $('btn-close-msg-search').onclick = closeMsgSearch;
  if ($('btn-msg-search-prev')) $('btn-msg-search-prev').onclick  = () => navMsgSearch(-1);
  if ($('btn-msg-search-next')) $('btn-msg-search-next').onclick  = () => navMsgSearch(1);
  let msd; $('msg-search-input').addEventListener('input', e => { clearTimeout(msd); msd = setTimeout(() => runMsgSearch(e.target.value.trim()), 300); });

  // Input
  $('send-btn').onclick = sendMessage;
  $('msg-input').addEventListener('keydown', e => { if (e.key==='Enter'&&!e.shiftKey) { e.preventDefault(); sendMessage(); } });
  $('msg-input').addEventListener('input', () => { autoResize($('msg-input')); onTypingInput(); });
  $('btn-clear-reply').onclick = clearReply;
  $('btn-emoji').onclick = toggleEmoji;
  if ($('file-upload')) $('file-upload').addEventListener('change', uploadFile);
  if ($('img-upload')) $('img-upload').addEventListener('change', uploadFile);
  $('btn-voice').onclick = toggleVoiceRecord;
  if ($('btn-cancel-voice')) $('btn-cancel-voice').onclick = cancelVoiceRecord;
  if ($('btn-send-voice')) $('btn-send-voice').onclick   = sendVoiceMessage;

  // Pinned / disappearing
  $('btn-unpin').onclick = unpinMessage;
  if ($('btn-disable-disappearing')) $('btn-disable-disappearing').onclick = () => setDisappear(0);
  if ($('pinned-bar')) $('pinned-bar').onclick = (e) => {
    if (e.target.closest('#btn-unpin')) return;
    const msgId = $('pinned-bar').dataset.msgId;
    if (msgId) {
      const row = document.querySelector(`.msg-row[data-id="${msgId}"]`);
      if (row) {
        row.querySelector('.bubble')?.classList.add('search-highlight');
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => row.querySelector('.bubble')?.classList.remove('search-highlight'), 2000);
      }
    }
  };

  // Settings / Profile Modal
  if ($('btn-close-settings')) $('btn-close-settings').onclick = () => closeModal('settings-modal');
  if ($('btn-close-profile')) $('btn-close-profile').onclick = () => closeModal('profile-modal');
  if ($('profile-modal')) $('profile-modal').onclick = e => { if (e.target===$('profile-modal')) closeModal('profile-modal'); };
  if ($('settings-modal')) $('settings-modal').addEventListener('click', e => { if (e.target===$('settings-modal')) closeModal('settings-modal'); });
  document.querySelectorAll('.settings-tabs .stab').forEach(b => b.onclick = () => switchSettingsTab(b.dataset.stab));
  if ($('btn-save-profile')) $('btn-save-profile').onclick = saveProfile;
  if ($('btn-toggle-2fa')) $('btn-toggle-2fa').onclick   = toggle2FASetup;
  if ($('btn-confirm-2fa')) $('btn-confirm-2fa').onclick  = confirm2FA;
  if ($('btn-apply-wallpaper')) $('btn-apply-wallpaper').onclick = applyCustomWallpaper;
  document.querySelectorAll('.theme-opt').forEach(o => o.onclick = () => setTheme(o.dataset.theme));
  if ($('toggle-hide-lastseen')) $('toggle-hide-lastseen').addEventListener('change', e => { sb.from('users').update({last_seen_hidden:e.target.checked}).eq('id',me.id); });
  if ($('toggle-notif-sound')) $('toggle-notif-sound').addEventListener('change', e => { notifSound = e.target.checked; localStorage.setItem('ph_notif_sound',e.target.checked?'1':'0'); });
  if ($('btn-open-blocklist')) $('btn-open-blocklist').onclick = () => { const s = $('blocklist-section'); if (s) { s.style.display = s.style.display==='none'?'':'none'; if(s.style.display!=='none') loadBlocklist(); } };
  if ($('block-search-in')) { let bsd; $('block-search-in').addEventListener('input', e => { clearTimeout(bsd); bsd = setTimeout(() => searchToBlock(e.target.value.trim()), 300); }); }
  if ($('disappear-select')) $('disappear-select').addEventListener('change', e => { if (currentChat) setDisappear(parseInt(e.target.value)); });
  if ($('disappear-default')) $('disappear-default').addEventListener('change', e => { disappearSeconds = parseInt(e.target.value); localStorage.setItem('ph_disappear', e.target.value); });

  // Context menu
  $('ctx-reply').onclick    = doReply;
  $('ctx-thread').onclick   = doOpenThread;
  $('ctx-star').onclick     = doStarMsg;
  $('ctx-copy').onclick     = doCopy;
  $('ctx-edit').onclick     = doEdit;
  $('ctx-pin').onclick      = doPinMsg;
  $('ctx-disappear').onclick = () => { hideCtx(); if ($('disappear-modal')) openModal('disappear-modal'); };
  $('ctx-delete').onclick   = doDelete;
  if ($('btn-close-thread')) $('btn-close-thread').onclick = () => { $('thread-drawer').style.display = 'none'; };
  if ($('thread-reply-send-btn')) $('thread-reply-send-btn').onclick = sendThreadReply;
  if ($('thread-reply-input')) $('thread-reply-input').addEventListener('keydown', e => { if (e.key==='Enter'&&!e.shiftKey) { e.preventDefault(); sendThreadReply(); } });
  if ($('btn-close-disappear')) $('btn-close-disappear').onclick = () => closeModal('disappear-modal');
  document.querySelectorAll('.disappear-options button').forEach(b => b.addEventListener('click', () => { setMsgDisappear(contextTarget?.msgId, parseInt(b.dataset.secs)||0); closeModal('disappear-modal'); }));
  document.addEventListener('click', e => { if (!e.target.closest('.ctx-menu')) hideCtx(); });
  document.addEventListener('click', e => { if (!e.target.closest('#emoji-picker')&&!e.target.closest('#btn-emoji')) { $('emoji-picker').style.display='none'; emojiOpen=false; } });
  $('mob-overlay').onclick = () => { $('sidebar').classList.remove('mob-open'); $('mob-overlay').classList.remove('show'); document.body.classList.remove('sidebar-open'); if($('info-panel').style.display!=='none') $('info-panel').style.display='none'; };
  document.addEventListener('click', e => { if (!e.target.closest('#panel-dms .sr-wrapper')) $('dm-search-results').classList.remove('open'); if (!e.target.closest('#panel-friends .sidebar-search')&&!e.target.closest('#friend-search-results')) $('friend-search-results').innerHTML=''; });

  // Stories
  if ($('btn-add-story')) $('btn-add-story').onclick = () => openModal('story-modal');
  if ($('btn-close-story-modal')) $('btn-close-story-modal').onclick = () => closeModal('story-modal');
  if ($('btn-post-story')) $('btn-post-story').onclick  = postStory;
  if ($('btn-close-story')) $('btn-close-story').onclick = closeStoryViewer;
  if ($('btn-story-prev')) $('btn-story-prev').onclick   = () => navStory(-1);
  if ($('btn-story-next')) $('btn-story-next').onclick   = () => navStory(1);
  document.querySelectorAll('.story-type').forEach(b => b.onclick = () => switchStoryType(b.dataset.type));
  if ($('story-img-upload')) $('story-img-upload').addEventListener('change', previewStoryImage);
  buildStoryColorPicker();
  buildWallpaperGrid();

  // Wallpaper toggle
  if ($('btn-wallpaper')) $('btn-wallpaper').onclick = () => {
    const wp = $('wallpaper-picker');
    if (wp) wp.style.display = wp.style.display==='none'?'block':'none';
  };
  if ($('btn-wallpaper-none')) $('btn-wallpaper-none').onclick = () => { applyWallpaper('background:var(--bg2)'); $('wallpaper-picker').style.display='none'; };
  if ($('wallpaper-upload')) $('wallpaper-upload').addEventListener('change', async e => {
    const file = e.target.files[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = ev => { applyWallpaper(`background:url(${ev.target.result}) center/cover no-repeat`); $('wallpaper-picker').style.display='none'; };
    reader.readAsDataURL(file);
  });
  if ($('btn-custom-wallpaper')) $('btn-custom-wallpaper').onclick = () => $('wallpaper-upload').click();

  // Sound toggle
  if ($('btn-sound')) $('btn-sound').onclick = () => {
    notifSound = !notifSound;
    const soundIcon = $('header-sound-icon');
    if (soundIcon) {
      soundIcon.setAttribute('data-lucide', notifSound ? 'bell' : 'bell-off');
    }
    localStorage.setItem('ph_notif_sound', notifSound ? '1' : '0');
    toast(notifSound ? 'Sound on' : 'Sound off');
    if (window.lucide) lucide.createIcons();
  };

  // GIF picker
  if ($('btn-gif')) $('btn-gif').onclick = () => {
    const gp = $('gif-picker');
    if (gp) gp.style.display = gp.style.display==='none'?'flex':'none';
  };
  if ($('btn-close-gif')) $('btn-close-gif').onclick = () => { $('gif-picker').style.display='none'; };
  let gsd;
  if ($('gif-search')) $('gif-search').addEventListener('input', e => {
    clearTimeout(gsd);
    gsd = setTimeout(() => searchGifs(e.target.value.trim()), 400);
  });

  // Image preview close
  if ($('btn-close-preview')) $('btn-close-preview').onclick = () => $('img-preview-modal').style.display='none';

  // Keyboard shortcut: Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeStoryViewer();
      closeAllModals();
      closeMsgSearch();
      hideCtx();
      closeMentions();
      if ($('thread-drawer')) $('thread-drawer').style.display = 'none';
    }
  });
}

function setupMobile() {
  const ph = $('chat-placeholder'); ph.style.position = 'relative';
  const ham = mk('button','icon-btn','☰');
  ham.style.cssText = 'position:absolute;top:1rem;left:1rem;font-size:1.3rem;z-index:30;display:none;';
  ham.id = 'mob-ham'; ph.insertBefore(ham, ph.firstChild);
  ham.onclick = () => { $('sidebar').classList.add('mob-open'); $('mob-overlay').classList.add('show'); document.body.classList.add('sidebar-open'); };
  const chk = () => ham.style.display = window.innerWidth<=768?'':'none';
  chk(); window.addEventListener('resize', chk);
  if (window.innerWidth <= 768) { $('sidebar').classList.add('mob-open'); $('mob-overlay').classList.add('show'); document.body.classList.add('sidebar-open'); }
}

// ═══════════════════════════════════════════════════════════
//  AUTH
// ═══════════════════════════════════════════════════════════
function showTab(t) {
  $('tab-login').classList.toggle('active', t==='login');
  $('tab-register').classList.toggle('active', t==='register');
  $('form-login').style.display    = t==='login'    ? 'block':'none';
  $('form-register').style.display = t==='register' ? 'block':'none';
  setAuthErr('');
}
function setAuthLoading(v) { $('auth-loading').style.display = v?'flex':'none'; }
function setAuthErr(m)     { $('auth-error').style.display = m?'block':'none'; $('auth-error').textContent = m; }

async function loginEmail() {
  const email=$('login-email').value.trim(), pw=$('login-password').value;
  if (!email||!pw) { setAuthErr('Please fill in all fields.'); return; }
  setAuthErr(''); setAuthLoading(true);
  const { error } = await sb.auth.signInWithPassword({ email, password: pw });
  if (error) setAuthErr(error.message);
  setAuthLoading(false);
}

async function registerEmail() {
  const name=$('reg-name').value.trim();
  let username=($('reg-username').value||'').trim().toLowerCase().replace(/[^a-z0-9._-]/g,'');
  const email=$('reg-email').value.trim(), pw=$('reg-password').value;
  if (!name) { setAuthErr('Enter your display name.'); return; }
  if (!email) { setAuthErr('Enter your email.'); return; }
  if (!pw||pw.length<6) { setAuthErr('Password needs at least 6 characters.'); return; }
  if (!username) username = email.split('@')[0].replace(/[^a-z0-9]/g,'') + Math.floor(Math.random()*9000+1000);
  if (username.length<3) { setAuthErr('Username must be at least 3 characters.'); return; }
  const { data: ex } = await sb.from('users').select('id').eq('username',username).maybeSingle();
  if (ex) { setAuthErr(`Username "${username}" is taken.`); return; }
  setAuthErr(''); setAuthLoading(true);
  const { error } = await sb.auth.signUp({ email, password: pw, options: { data: { name, username, avatar: selectedAv } } });
  if (error) { setAuthErr(error.message); setAuthLoading(false); return; }
  toast('Check your email to verify, then sign in.'); showTab('login');
  setAuthLoading(false);
}

async function loginGoogle() {
  setAuthErr(''); setAuthLoading(true);
  const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + window.location.pathname } });
  if (error) { setAuthErr(error.message); setAuthLoading(false); }
}

async function logout() {
  if (!me) return;
  await sb.from('users').update({online:false,last_seen:new Date().toISOString()}).eq('id',me.id);
  unsubAll();
  await sb.auth.signOut();
  me = null; myData = {};
  $('app').style.display = 'none';
  showAuth();
}

function togglePw(id, btn) {
  const i=$(id);
  i.type = i.type==='password'?'text':'password';
  btn.innerHTML = i.type==='password'?'<i data-lucide="eye"></i>':'<i data-lucide="eye-off"></i>';
  if (window.lucide) lucide.createIcons();
}

// ═══════════════════════════════════════════════════════════
//  2FA
// ═══════════════════════════════════════════════════════════
function show2FA() {
  $('auth-screen').style.display = 'none';
  const tfaScr = $('tfa-screen'); if (tfaScr) tfaScr.style.display = 'flex';
  pending2FAUser = me;
}

function wire2FAInputs() {
  const inputs = document.querySelectorAll('.otp-box');
  inputs.forEach((inp, i) => {
    inp.addEventListener('input', () => {
      inp.value = inp.value.replace(/\D/,'');
      if (inp.value && i < inputs.length-1) inputs[i+1].focus();
      if (i === inputs.length-1 && inp.value) verify2FA();
    });
    inp.addEventListener('keydown', e => { if (e.key==='Backspace'&&!inp.value&&i>0) inputs[i-1].focus(); });
  });
}

async function verify2FA() {
  const code = Array.from(document.querySelectorAll('.otp-box')).map(i=>i.value).join('');
  if (code.length !== 6) { show2FAErr('Enter all 6 digits'); return; }
  // Simple TOTP verification using jsOTP or manual check
  // For demo: check against stored secret using TOTP algorithm
  const valid = await verifyTOTP(myData.two_fa_secret, code);
  if (valid) { const s = $('tfa-screen'); if (s) s.style.display='none'; showApp(); }
  else show2FAErr('Invalid code. Try again.');
}

async function verifyTOTP(secret, token) {
  // Simple TOTP implementation
  try {
    const epoch = Math.round(Date.now()/1000);
    const time  = Math.floor(epoch/30);
    for (let d=-1; d<=1; d++) {
      const t = time + d;
      const expected = await generateTOTP(secret, t);
      if (expected === token) return true;
    }
    return false;
  } catch { return false; }
}

async function generateTOTP(base32secret, counter) {
  const key   = base32Decode(base32secret);
  const msg   = new ArrayBuffer(8);
  const view  = new DataView(msg);
  view.setUint32(4, counter, false);
  const hmacKey = await crypto.subtle.importKey('raw', key, {name:'HMAC',hash:'SHA-1'}, false, ['sign']);
  const sig     = await crypto.subtle.sign('HMAC', hmacKey, msg);
  const arr     = new Uint8Array(sig);
  const offset  = arr[19] & 0xf;
  const code    = ((arr[offset]&0x7f)<<24|(arr[offset+1]&0xff)<<16|(arr[offset+2]&0xff)<<8|(arr[offset+3]&0xff)) % 1000000;
  return String(code).padStart(6,'0');
}

function base32Decode(s) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  s = s.toUpperCase().replace(/=+$/,'');
  let bits=0, val=0, output=[];
  for (const c of s) { val=(val<<5)|chars.indexOf(c); bits+=5; if(bits>=8){output.push((val>>>(bits-8))&255);bits-=8;} }
  return new Uint8Array(output);
}

function show2FAErr(m) { const e=$('tfa-error'); e.style.display='block'; e.textContent=m; }
function showBackupInput() { /* show backup code input */ toast('Enter your backup code in the first field'); }

// ═══════════════════════════════════════════════════════════
//  PROFILE & SETTINGS
// ═══════════════════════════════════════════════════════════
async function ensureProfile() {
  const { data: existing } = await sb.from('users').select('*').eq('id', me.id).maybeSingle();
  if (existing) {
    await sb.from('users').update({ online: true, last_seen: new Date().toISOString() }).eq('id', me.id);
    return;
  }

  const meta = me.user_metadata||{};
  const name = meta.name||meta.full_name||me.email?.split('@')[0]||'User';
  let avatar = meta.avatar_url||meta.picture||selectedAv;
  const username = meta.username||(me.email?.split('@')[0].replace(/[^a-z0-9]/g,'')+Math.floor(Math.random()*9000+1000));

  if (avatar && avatar.startsWith('data:image/')) {
    try {
      const mimeType = avatar.split(';')[0].split(':')[1];
      const ext = mimeType.split('/')[1] || 'png';
      const response = await fetch(avatar);
      const blob = await response.blob();
      const path = `avatars/${me.id}_${Date.now()}.${ext}`;
      const { error } = await sb.storage.from(BUCKET).upload(path, blob, { contentType: mimeType, upsert: true });
      if (!error) {
        const { data: { publicUrl } } = sb.storage.from(BUCKET).getPublicUrl(path);
        avatar = publicUrl;
        await sb.auth.updateUser({ data: { avatar: publicUrl } });
      }
    } catch (e) {
      console.error('Failed to upload registration profile photo to storage', e);
    }
  }

  await sb.from('users').insert({ id:me.id, name, avatar, email:me.email||'', username, status:'Available', online:true, last_seen:new Date().toISOString() });
}

async function getMyData() {
  const { data } = await sb.from('users').select('*').eq('id',me.id).single();
  myData = data||{}; return myData;
}

async function loadMyProfile() {
  await getMyData();
  const u = myData;
  $('my-name').textContent = u.name||'Me';
  $('my-status-display').textContent = u.username?'@'+u.username:(u.status||'Available');
  renderAv($('my-avatar'), u.avatar||'?');
  
  // Update sectioned sidebar footer details
  if ($('nav-profile-name')) $('nav-profile-name').textContent = u.name||'Me';
  if ($('nav-profile-username')) $('nav-profile-username').textContent = u.username?'@'+u.username:'';
  if ($('nav-profile-av')) renderAv($('nav-profile-av'), u.avatar||'?');

  // Update feed right sidebar details
  if ($('feed-right-my-name')) $('feed-right-my-name').textContent = u.name||'Me';
  if ($('feed-right-my-username')) $('feed-right-my-username').textContent = u.username?'@'+u.username:'';
  if ($('feed-right-my-avatar')) renderAv($('feed-right-my-avatar'), u.avatar||'?');

  $('profile-name-in').value     = u.name||'';
  $('profile-status-in').value   = u.status||'';
  $('profile-username-in').value = u.username||'';
  $('profile-bio-in').value      = u.bio||'';
  renderAv($('profile-avatar-big'), u.avatar||'?');
  selectedAv = u.avatar||'?';
  const hint = $('username-change-hint');
  if (hint && u.username_changed_at) {
    const days = (Date.now()-u.username_changed_at)/(1000*60*60*24);
    if (days<7) { const left=Math.ceil(7-days); hint.textContent=`Change again in ${left} day${left>1?'s':''}`; hint.style.color='var(--danger)'; }
    else { hint.textContent='Can change once/week'; hint.style.color='var(--text3)'; }
  }
  if ($('premium-theme-select')) $('premium-theme-select').value = u.theme_color || 'default';
  if ($('premium-badge-select')) $('premium-badge-select').value = u.badge || 'none';
  if (u.role === 'owner' || u.role === 'admin' || u.role === 'premium') {
    if ($('premium-customization-sec')) $('premium-customization-sec').style.display = 'block';
  } else {
    if ($('premium-customization-sec')) $('premium-customization-sec').style.display = 'none';
  }
  applyTheme(u.theme_color);
  // Check if my avatar has a story
  const { data: myStories } = await sb.from('stories').select('id').eq('user_id',me.id).gt('expires_at',new Date().toISOString());
  if (myStories?.length) $('my-avatar-wrap').classList.add('has-story');
  else $('my-avatar-wrap').classList.remove('has-story');
  // Load 2FA status
  if ($('tfa-status-label')) {
    $('tfa-status-label').textContent = u.two_fa_enabled?'2FA is enabled':'2FA is disabled';
    $('tfa-status-icon').innerHTML  = u.two_fa_enabled?'<i data-lucide="lock"></i>':'<i data-lucide="unlock"></i>';
    $('btn-toggle-2fa').textContent   = u.two_fa_enabled?'Disable':'Enable';
    if (window.lucide) lucide.createIcons();
  }
  if ($('toggle-hide-lastseen')) $('toggle-hide-lastseen').checked = !!u.last_seen_hidden;
}

async function saveProfile() {
  const name   = $('profile-name-in').value.trim()||'User';
  const status = $('profile-status-in').value.trim()||'Available';
  const bio    = $('profile-bio-in').value.trim()||'';
  let newUsername = ($('profile-username-in').value||'').trim().toLowerCase().replace(/[^a-z0-9._-]/g,'');
  const themeColor = $('premium-theme-select') ? $('premium-theme-select').value : 'default';
  const badge = $('premium-badge-select') ? $('premium-badge-select').value : 'none';
  const updates = { name, status, bio, avatar: selectedAv, theme_color: themeColor, badge: badge };
  if (newUsername && newUsername !== (myData.username||'')) {
    if (newUsername.length<3) { toast('Username must be at least 3 characters'); return; }
    const lastChanged = myData.username_changed_at||0;
    const daysSince   = (Date.now()-lastChanged)/(1000*60*60*24);
    if (lastChanged>0 && daysSince<7) { const l=Math.ceil(7-daysSince); toast(`Can change username in ${l} day${l>1?'s':''}`); return; }
    const { data: ex } = await sb.from('users').select('id').eq('username',newUsername).neq('id',me.id).maybeSingle();
    if (ex) { toast(`Username "${newUsername}" is taken`); return; }
    updates.username = newUsername;
    updates.username_changed_at = Date.now();
  }
  await sb.from('users').update(updates).eq('id',me.id);
  loadMyProfile(); closeModal('profile-modal'); toast('Profile updated ✓');
}

function loadSettings() {
  notifSound = localStorage.getItem('ph_notif_sound') !== '0';
  if ($('toggle-notif-sound')) $('toggle-notif-sound').checked = notifSound;
  disappearSeconds = parseInt(localStorage.getItem('ph_disappear')||'0');
  if ($('disappear-default')) $('disappear-default').value = String(disappearSeconds);
  const saved = localStorage.getItem('phantom_theme')||'light';
  setTheme(saved);
}

function switchSettingsTab(tab) {
  document.querySelectorAll('.settings-tabs .stab').forEach(b => b.classList.toggle('active', b.dataset.stab===tab));
  document.querySelectorAll('.settings-panel').forEach(p => p.classList.remove('active'));
  $(`stab-${tab}`).classList.add('active');
  if (tab==='security' && currentChat && $('disappear-bar')) $('disappear-bar').style.display='flex';
}

// ── 2FA Setup ─────────────────────────────────────────────
async function toggle2FASetup() {
  if (myData.two_fa_enabled) {
    await sb.from('users').update({two_fa_enabled:false,two_fa_secret:''}).eq('id',me.id);
    toast('2FA disabled'); loadMyProfile();
  } else {
    // Generate a TOTP secret
    const secret = generateTOTPSecret();
    await sb.from('users').update({two_fa_secret:secret}).eq('id',me.id);
    myData.two_fa_secret = secret;
    $('tfa-setup').style.display = 'block';
    $('tfa-secret-code').textContent = secret;
    // Generate QR code URL
    const email = myData.email||me.email||'user';
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=otpauth://totp/PhantomChat:${encodeURIComponent(email)}?secret=${secret}%26issuer=PhantomChat`;
    $('tfa-qr').innerHTML = `<img src="${qrUrl}" alt="QR Code" style="width:100%;height:100%;"/>`;
  }
}

async function confirm2FA() {
  const code = $('tfa-verify-in').value.trim();
  if (code.length !== 6) { toast('Enter 6-digit code'); return; }
  const valid = await verifyTOTP(myData.two_fa_secret, code);
  if (!valid) { toast('Invalid code — try again'); return; }
  await sb.from('users').update({two_fa_enabled:true}).eq('id',me.id);
  $('tfa-setup').style.display = 'none';
  toast('2FA enabled successfully!'); loadMyProfile();
}

function generateTOTPSecret() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  return Array.from(crypto.getRandomValues(new Uint8Array(20))).map(b => chars[b%32]).join('');
}

// ── Theme & Wallpaper ─────────────────────────────────────
function toggleTheme() { setTheme(document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark'); }
function setTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('phantom_theme', t);
  
  const sidebarIcon = $('sidebar-theme-icon');
  if (sidebarIcon) {
    sidebarIcon.setAttribute('data-lucide', t==='dark'?'sun':'moon');
  }
  const navIcon = $('nav-theme-icon');
  if (navIcon) {
    navIcon.setAttribute('data-lucide', t==='dark'?'sun':'moon');
  }

  const authThemeBtn = $('auth-theme-btn');
  if (authThemeBtn) {
    const icon = $('auth-theme-icon-svg');
    const text = authThemeBtn.querySelector('.theme-text');
    if (icon) icon.setAttribute('data-lucide', t==='dark'?'moon':'sun');
    if (text) text.textContent = t==='dark'?'Dark Mode':'Light Mode';
  }

  if (window.lucide) lucide.createIcons();
  document.querySelectorAll('.theme-opt').forEach(o => o.classList.toggle('active', o.dataset.theme===t));
}

function buildWallpaperGrid() {
  const g = $('wp-grid'); if (!g) return;
  WALLPAPERS.forEach(w => {
    const d = mk('div','wallpaper-opt');
    d.setAttribute('style', w.style+';');
    d.title = w.id;
    d.onclick = () => applyWallpaper(w.style);
    g.appendChild(d);
  });
}

function applyWallpaper(style) {
  chatWallpaper = style;
  const ma = $('messages-area');
  if (ma) ma.setAttribute('style', style+';flex:1;overflow-y:auto;padding:.8rem 1rem;display:flex;flex-direction:column;scroll-behavior:smooth;');
  localStorage.setItem('ph_wallpaper', style);
  if (currentChat) sb.from('conversations').update({wallpaper:style}).eq('id',currentChat.convId);
}

function applyCustomWallpaper() {
  // Custom wallpaper via URL not in HTML; handled by file upload now
  toast('Use the upload button to set a custom wallpaper');
}

// ── Block & Report ────────────────────────────────────────
async function searchToBlock(q) {
  const res = $('block-results'); res.innerHTML='';
  if (!q) return;
  const { data } = await sb.from('users').select('*').neq('id',me.id).or(`name.ilike.%${q}%,username.ilike.%${q}%`).limit(8);
  (data||[]).forEach(u => {
    const row = mk('div','');
    row.style.cssText='display:flex;align-items:center;justify-content:space-between;padding:.4rem .2rem;border-bottom:1px solid var(--border);';
    const info = mk('span','',`${esc(u.name)} ${u.username?'<span style="color:var(--text3);font-size:.72rem;">@'+esc(u.username)+'</span>':''}`);
    const bBtn = mk('button','freq-btn decline','Block');
    bBtn.onclick = () => blockUser(u.id, u.name);
    const rBtn = mk('button','freq-btn','Report');
    rBtn.style.cssText='background:rgba(245,158,11,.1);color:#f59e0b;border:1px solid rgba(245,158,11,.2);margin-left:.4rem;';
    rBtn.onclick = () => reportUser(u.id, u.name);
    row.append(info, mk('div','','')); row.lastChild.append(bBtn,rBtn);
    res.appendChild(row);
  });
}

async function blockUser(uid, name) {
  await sb.from('blocks').upsert({blocker_id:me.id,blocked_id:uid},{onConflict:'blocker_id,blocked_id',ignoreDuplicates:true});
  toast(`${name} blocked`); loadBlocklist();
}

async function reportUser(uid, name) {
  const reason = prompt(`Report reason for ${name}:`);
  if (!reason) return;
  await sb.from('reports').insert({reporter_id:me.id,reported_id:uid,reason});
  toast('Report submitted. Thank you.');
}

async function loadBlocklist() {
  const { data } = await sb.from('blocks').select('blocked_id,users!blocked_id(name,username)').eq('blocker_id',me.id);
  const el = $('blocked-list'); el.innerHTML='';
  if (!data?.length) { el.innerHTML='<div class="list-empty" style="padding:.6rem;">No blocked users.</div>'; return; }
  data.forEach(b => {
    const u = b.users; if (!u) return;
    const row = mk('div','');
    row.style.cssText='display:flex;align-items:center;justify-content:space-between;padding:.4rem .2rem;border-bottom:1px solid var(--border);font-size:.83rem;';
    const name = mk('span','',`${esc(u.name)} ${u.username?'<span style="color:var(--text3);font-size:.7rem;">@'+esc(u.username)+'</span>':''}`);
    const unblock = mk('button','freq-btn accept','Unblock');
    unblock.onclick = async () => { await sb.from('blocks').delete().eq('blocker_id',me.id).eq('blocked_id',b.blocked_id); loadBlocklist(); toast(`${u.name} unblocked`); };
    row.append(name, unblock); el.appendChild(row);
  });
}

// ═══════════════════════════════════════════════════════════
//  STORIES
// ═══════════════════════════════════════════════════════════
async function loadStories() {
  const inner = $('stories-list'); if (!inner) return; inner.innerHTML='';
  const now = new Date().toISOString();
  // Get friends
  const { data: frs } = await sb.from('friends').select('friend_id').eq('user_id',me.id).eq('status','accepted');
  const friendIds = (frs||[]).map(f=>f.friend_id);
  if (!friendIds.length) return;
  // Get stories for friends
  const { data: stories } = await sb.from('stories').select('*,users(*)').in('user_id',friendIds).gt('expires_at',now).order('created_at',{ascending:false});
  if (!stories?.length) return;
  // Group by user
  const byUser = {};
  stories.forEach(s => { if (!byUser[s.user_id]) byUser[s.user_id] = []; byUser[s.user_id].push(s); });
  for (const [uid, userStories] of Object.entries(byUser)) {
    const u = userStories[0].users||{};
    const { data: viewed } = await sb.from('story_views').select('story_id').eq('viewer_id',me.id);
    const viewedIds = new Set((viewed||[]).map(v=>v.story_id));
    const allViewed = userStories.every(s=>viewedIds.has(s.id));
    const thumb = mk('div', `story-thumb${allViewed?'':' unviewed'}`);
    const av = mk('div','story-thumb-av'); renderAv(av, u.avatar||'?');
    const label = mk('span','',esc((u.name||'?').split(' ')[0]));
    thumb.append(av, label);
    thumb.onclick = () => openStoryViewer(userStories, u);
    inner.appendChild(thumb);
  }
}

function openStoryViewer(stories, user) {
  currentStories = stories; storyIndex = 0;
  $('stories-overlay').style.display = 'flex';
  showStory(0);
  renderAv($('sv-avatar'), user.avatar||'?');
  $('sv-name').textContent = user.name||'?';
}

function showStory(idx) {
  if (idx < 0 || idx >= currentStories.length) { closeStoryViewer(); return; }
  storyIndex = idx;
  clearTimeout(storyTimer);
  const story = currentStories[idx];
  $('sv-time').textContent = relTime(new Date(story.created_at).getTime());
  const content = $('sv-content'); content.innerHTML='';
  if (story.media_url) {
    const img = mk('img',''); img.src = story.media_url; img.alt='story';
    img.style.cssText='max-width:100%;max-height:100%;object-fit:contain;border-radius:12px;';
    content.appendChild(img);
  } else {
    const div = mk('div','story-text-display', esc(story.text_content||''));
    div.style.background = story.bg_color||'linear-gradient(135deg,#667eea,#764ba2)';
    content.appendChild(div);
    content.style.background = story.bg_color||'linear-gradient(135deg,#667eea,#764ba2)';
  }
  const fill = $('sv-progress-fill');
  if (fill) { fill.style.transition = 'none'; fill.style.width = '0%';
  setTimeout(() => { fill.style.transition = 'width 5s linear'; fill.style.width='100%'; }, 50); }
  storyTimer = setTimeout(() => navStory(1), 5000);
  sb.from('story_views').upsert({story_id:story.id,viewer_id:me.id},{onConflict:'story_id,viewer_id',ignoreDuplicates:true});
}

function navStory(dir) { showStory(storyIndex + dir); }
function closeStoryViewer() {
  clearTimeout(storyTimer);
  $('stories-overlay').style.display = 'none';
}

function switchStoryType(t) {
  document.querySelectorAll('.story-type').forEach(b => b.classList.toggle('active', b.dataset.type===t));
}

function buildStoryColorPicker() {
  const g = $('story-bg-picker'); if (!g) return;
  // Add click handlers to existing bg-opt elements in HTML
  g.querySelectorAll('.story-bg-opt').forEach((opt, i) => {
    if (i===0) opt.classList.add('selected');
    opt.onclick = () => {
      g.querySelectorAll('.story-bg-opt').forEach(x => x.classList.remove('selected'));
      opt.classList.add('selected');
    };
  });
}

function previewStoryImage() {
  const file = $('story-img-upload').files[0]; if (!file) return;
  if ($('story-img-name')) $('story-img-name').textContent = file.name;
}

async function postStory() {
  const storyData = { user_id: me.id };
  const text = $('story-text-in').value.trim();
  const fileInput = $('story-img-upload');
  const file = fileInput ? fileInput.files[0] : null;
  if (file) {
    const path = `stories/${me.id}/${Date.now()}.${file.name.split('.').pop()}`;
    toast('Uploading story...');
    const { error } = await sb.storage.from(BUCKET).upload(path, file, {contentType:file.type,upsert:true});
    if (error) { toast('Upload failed: '+error.message); return; }
    const { data: { publicUrl } } = sb.storage.from(BUCKET).getPublicUrl(path);
    storyData.media_url = publicUrl; storyData.media_type = 'image';
    if (text) storyData.text_content = text;
  } else if (text) {
    const selBg = document.querySelector('.story-bg-opt.selected');
    const bg = selBg ? (selBg.dataset.bg || 'linear-gradient(135deg,#667eea,#764ba2)') : 'linear-gradient(135deg,#667eea,#764ba2)';
    storyData.text_content = text; storyData.bg_color = bg; storyData.media_type = 'text';
  } else {
    toast('Write something or choose an image'); return;
  }
  storyData.expires_at = new Date(Date.now() + 24*60*60*1000).toISOString();
  await sb.from('stories').insert(storyData);
  closeModal('story-modal');
  toast('Story posted!');
  loadStories(); loadMyProfile();
  $('story-text-in').value = '';
  if ($('story-img-name')) $('story-img-name').textContent = '';
  if (fileInput) fileInput.value = '';
}

// ═══════════════════════════════════════════════════════════
//  FRIENDS
// ═══════════════════════════════════════════════════════════
async function searchFriendUsers(q) {
  const res = $('friend-search-results'); res.innerHTML='';
  if (!q) { $('suggested-users').style.display=''; return; }
  $('suggested-users').style.display='none';
  showSkeleton(res, 3);
  const { data: users } = await sb.from('users').select('*').neq('id',me.id).or(`name.ilike.%${q}%,username.ilike.%${q}%,email.ilike.%${q}%`).limit(15);
  res.innerHTML='';
  if (!users?.length) { res.innerHTML='<div class="list-empty" style="padding:.8rem;">No users found.</div>'; return; }
  const { data: frData } = await sb.from('friends').select('friend_id,status').eq('user_id',me.id);
  const frMap = {}; (frData||[]).forEach(f => frMap[f.friend_id]=f.status);
  const { data: bData } = await sb.from('blocks').select('blocked_id').eq('blocker_id',me.id);
  const blocked = new Set((bData||[]).map(b=>b.blocked_id));
  users.filter(u=>!blocked.has(u.id)).forEach(u => res.appendChild(buildUserRow(u.id,u,frMap)));
}

async function loadSuggestedUsers() {
  const el = $('suggested-users'); if (!el) return;
  showSkeleton(el, 4);
  const { data: users } = await sb.from('users').select('*').neq('id',me.id).limit(20);
  const { data: frData } = await sb.from('friends').select('friend_id,status').eq('user_id',me.id);
  const frMap = {}; (frData||[]).forEach(f => frMap[f.friend_id]=f.status);
  el.innerHTML='';
  const suggestions = (users||[]).filter(u=>frMap[u.id]!=='accepted');
  if (!suggestions.length) { el.innerHTML='<div class="list-empty" style="padding:1rem;">No suggestions.</div>'; return; }
  suggestions.forEach(u => el.appendChild(buildUserRow(u.id,u,frMap)));
}

function buildUserRow(uid, u, frMap) {
  const item = buildChatItem({avatar:u.avatar||'?',name:u.name||'?',preview:u.username?'@'+u.username:(u.email||''),time:'',unread:0,online:!!u.online});
  const rel = frMap?frMap[uid]:undefined;
  const btn = mk('button','freq-btn');
  if (rel==='accepted') { btn.className='freq-btn pending'; btn.textContent='Friends ✓'; btn.disabled=true; }
  else if (rel==='pending') { btn.className='freq-btn pending'; btn.textContent='Sent ✓'; btn.disabled=true; }
  else { btn.className='freq-btn accept'; btn.textContent='+ Add'; btn.onclick = e => { e.stopPropagation(); sendFriendRequest(uid); }; }
  item.style.flex='1'; item.style.padding='0';
  const row = mk('div',''); row.style.cssText='display:flex;align-items:center;padding:.45rem .7rem;border-bottom:1px solid var(--border);';
  row.append(item, btn); return row;
}

async function sendFriendRequest(toUid) {
  await sb.from('friends').upsert({user_id:me.id,friend_id:toUid,status:'pending'},{onConflict:'user_id,friend_id'});
  await sb.from('friends').upsert({user_id:toUid,friend_id:me.id,status:'pending'},{onConflict:'user_id,friend_id',ignoreDuplicates:true});
  toast('Friend request sent!'); searchFriendUsers($('friend-search').value.trim()); loadSuggestedUsers();
}

async function acceptFriendRequest(fromUid) {
  await sb.from('friends').update({status:'accepted'}).eq('user_id',me.id).eq('friend_id',fromUid);
  await sb.from('friends').update({status:'accepted'}).eq('user_id',fromUid).eq('friend_id',me.id);
  toast('Friend added!'); loadFriendRequests(); loadFriendsList();
}

async function declineFriendRequest(fromUid) {
  await sb.from('friends').delete().eq('user_id',me.id).eq('friend_id',fromUid);
  await sb.from('friends').delete().eq('user_id',fromUid).eq('friend_id',me.id);
  toast('Declined.'); loadFriendRequests();
}

async function loadFriendRequests() {
  const { data } = await sb.from('friends').select('user_id').eq('friend_id',me.id).eq('status','pending');
  const { data: myPending } = await sb.from('friends').select('friend_id').eq('user_id',me.id).eq('status','pending');
  const iSent = new Set((myPending||[]).map(r=>r.friend_id));
  const incoming = (data||[]).filter(r=>!iSent.has(r.user_id));
  const el = $('incoming-requests'); el.innerHTML='';
  if (!incoming.length) { el.innerHTML='<div class="list-empty" style="padding:1rem;">No pending requests.</div>'; $('req-badge').style.display='none'; $('mob-req-badge').style.display='none'; return; }
  $('req-badge').textContent = incoming.length; $('req-badge').style.display='inline-flex';
  $('mob-req-badge').textContent = incoming.length; $('mob-req-badge').style.display='inline-flex';
  for (const r of incoming) {
    const { data: u } = await sb.from('users').select('*').eq('id',r.user_id).single(); if (!u) continue;
    const item = mk('div','friend-req-item');
    const av = mk('div','avatar'); renderAv(av,u.avatar||'?'); av.style.cssText='width:36px;height:36px;font-size:1rem;flex-shrink:0;';
    const info = mk('div','freq-info'); info.innerHTML=`<div class="freq-name">${esc(u.name||'?')}</div><div class="freq-sub">Wants to be friends</div>`;
    const acc = mk('button','freq-btn accept','Accept'); const dec = mk('button','freq-btn decline','Decline');
    acc.onclick = () => acceptFriendRequest(r.user_id); dec.onclick = () => declineFriendRequest(r.user_id);
    const acts = mk('div','freq-actions'); acts.append(acc,dec);
    item.append(av,info,acts); el.appendChild(item);
  }
}

async function loadFriendsList() {
  const el = $('friends-list'); showSkeleton(el, 3);
  const { data } = await sb.from('friends').select('friend_id').eq('user_id',me.id).eq('status','accepted');
  el.innerHTML='';
  if (!data?.length) { el.innerHTML='<div class="list-empty" style="padding:1rem;">No friends yet.</div>'; return; }
  for (const r of data) {
    const { data: u } = await sb.from('users').select('*').eq('id',r.friend_id).single(); if (!u) continue;
    const item = buildChatItem({avatar:u.avatar||'?',name:u.name||'?',preview:u.status||'',time:'',unread:0,online:!!u.online});
    const msgBtn = mk('button','freq-btn accept','Message');
    msgBtn.onclick = e => { e.stopPropagation(); openDM(u); switchPanel('dms'); };
    const row = mk('div',''); row.style.cssText='display:flex;align-items:center;padding:.45rem .7rem;border-bottom:1px solid var(--border);';
    item.style.flex='1'; item.style.padding='0'; row.append(item,msgBtn); el.appendChild(row);
  }
}

function subscribeToFriendRequests() {
  const sub = sb.channel('friend-req-'+me.id)
    .on('postgres_changes',{event:'*',schema:'public',table:'friends',filter:`friend_id=eq.${me.id}`},()=>{loadFriendRequests();loadFriendsList();})
    .subscribe();
  rtSubs.push(sub);
}

// ═══════════════════════════════════════════════════════════
//  DM / ROOMS / GROUPS LISTS
// ═══════════════════════════════════════════════════════════
async function loadDMList() {
  const el = $('dm-list'); showSkeleton(el, 5);
  const { data: memberships } = await sb.from('conversation_members').select('conversation_id,unread_count,conversations(*)').eq('user_id',me.id);
  const dms = (memberships||[]).filter(m=>m.conversations?.type==='dm');
  el.innerHTML='';
  if (!dms.length) { el.innerHTML='<div class="list-empty">No conversations yet.<br/>Add friends to start chatting!</div>'; return; }
  for (const m of dms) {
    const conv = m.conversations;
    const { data: others } = await sb.from('conversation_members').select('user_id').eq('conversation_id',conv.id).neq('user_id',me.id);
    if (!others?.length) continue;
    const { data: u } = await sb.from('users').select('*').eq('id',others[0].user_id).single(); if (!u) continue;
    const { data: msgs } = await sb.from('messages').select('text,voice_url,image_url,created_at').eq('conversation_id',conv.id).order('created_at',{ascending:false}).limit(1);
    const last = msgs?.[0];
    let preview = last?.text||'';
    if (!preview && last?.voice_url) preview = 'Voice message';
    if (!preview && last?.image_url) preview = 'Image';
    const item = buildChatItem({avatar:u.avatar||'?',name:u.name||'?',preview,time:last?relTime(new Date(last.created_at).getTime()):'',unread:m.unread_count||0,online:!!u.online});
    item.addEventListener('click',()=>openDM(u,conv.id));
    if (currentChat?.convId===conv.id) item.classList.add('active');
    el.appendChild(item);
  }
}

async function loadRooms() {
  const el = $('rooms-inner'); showSkeleton(el, 3);
  const { data } = await sb.from('conversations').select('*').eq('type','room').order('created_at');
  allRoomsCache = data || [];
  el.innerHTML='';
  if (!data?.length) { el.innerHTML='<div class="list-empty">No rooms yet.</div>'; return; }
  data.forEach(r => {
    const preview = r.tags ? r.tags + ' · ' + (r.description||'') : r.description||'';
    const item = buildChatItem({avatar:'🏠',name:r.name,preview,time:'',unread:0});
    item.addEventListener('click',()=>openConv(r));
    if (currentChat?.convId===r.id) item.classList.add('active');
    el.appendChild(item);
  });
}

async function loadGroups() {
  const el = $('groups-inner'); showSkeleton(el, 3);
  const { data: mbrs } = await sb.from('conversation_members').select('conversation_id,conversations(*)').eq('user_id',me.id);
  const groups = (mbrs||[]).filter(m=>m.conversations?.type==='group');
  el.innerHTML='';
  if (!groups.length) { el.innerHTML='<div class="list-empty">No groups yet.</div>'; return; }
  groups.forEach(({conversations:g})=>{
    const item = buildChatItem({avatar:g.icon||'👥',name:g.name,preview:'',time:'',unread:0});
    item.addEventListener('click',()=>openConv(g));
    if (currentChat?.convId===g.id) item.classList.add('active');
    el.appendChild(item);
  });
}

async function searchDmUsers(q) {
  const res = $('dm-search-results');
  if (!q) { res.classList.remove('open'); res.innerHTML=''; return; }
  const { data: users } = await sb.from('users').select('*').neq('id',me.id).or(`name.ilike.%${q}%,username.ilike.%${q}%,email.ilike.%${q}%`).limit(10);
  res.innerHTML='';
  if (!users?.length) { res.innerHTML='<div class="list-empty" style="padding:.7rem;">No users found.</div>'; res.classList.add('open'); return; }
  users.forEach(u => {
    const item = buildChatItem({avatar:u.avatar||'?',name:u.name||'?',preview:u.username?'@'+u.username:'',time:'',unread:0,online:!!u.online});
    item.addEventListener('click',()=>{openDM(u);res.classList.remove('open');$('dm-search').value='';});
    res.appendChild(item);
  });
  res.classList.add('open');
}

// ═══════════════════════════════════════════════════════════
//  OPEN CHATS
// ═══════════════════════════════════════════════════════════
async function openDM(user, existingConvId=null) {
  currentChatMembers = [];
  let convId = existingConvId;
  if (!convId) {
    const { data: myConvs }    = await sb.from('conversation_members').select('conversation_id').eq('user_id',me.id);
    const { data: theirConvs } = await sb.from('conversation_members').select('conversation_id').eq('user_id',user.id);
    const myIds  = new Set((myConvs||[]).map(r=>r.conversation_id));
    const shared = (theirConvs||[]).find(r=>myIds.has(r.conversation_id));
    if (shared) {
      const { data: c } = await sb.from('conversations').select('*').eq('id',shared.conversation_id).eq('type','dm').single();
      if (c) convId = c.id;
    }
    if (!convId) {
      const { data: conv, error } = await sb.from('conversations').insert({type:'dm',created_by:me.id}).select().single();
      if (error || !conv) { toast('Could not start conversation: '+(error?.message||'Unknown error')); return; }
      convId = conv.id;
      await sb.from('conversation_members').insert([{conversation_id:convId,user_id:me.id},{conversation_id:convId,user_id:user.id}]);
    }
  }
  currentChat = {convId, type:'dm', name:user.name||'?', otherId:user.id, avatar:user.avatar||'?'};
  showChatUI(user.name||'?', user.avatar||'?');
  $('chat-hdr-sub').textContent = user.online?'🟢 Online':'⚫ Offline';
  await sb.from('conversation_members').update({unread_count:0}).eq('conversation_id',convId).eq('user_id',me.id);
  loadMessages(convId);
  subscribeMessages(convId);
  subscribeTyping(convId);
  loadPinnedMessage(convId);
  // Load wallpaper for this conv
  const { data: convData } = await sb.from('conversations').select('wallpaper').eq('id',convId).single();
  if (convData?.wallpaper) applyWallpaper(convData.wallpaper);
  else { const saved = localStorage.getItem('ph_wallpaper'); if (saved) applyWallpaper(saved); }
  // Show disappear settings for this chat
  if ($('disappear-bar')) $('disappear-bar').style.display='flex';
  // Check if any messages have disappear set
  checkDisappearingMode(convId);
}

async function openConv(conv) {
  currentChatMembers = [];
  let count = 0;
  if (conv.type==='group') { const {count:c} = await sb.from('conversation_members').select('*',{count:'exact',head:true}).eq('conversation_id',conv.id); count=c||0; }
  currentChat = {convId:conv.id, type:conv.type, name:conv.name, avatar:conv.icon||(conv.type==='room'?'🏠':'👥')};
  showChatUI(conv.name, conv.icon||(conv.type==='room'?'🏠':'👥'));
  $('chat-hdr-sub').textContent = conv.type==='group'?`${count} members`:(conv.description||'Public room');
  if (conv.type==='room') await sb.from('conversation_members').upsert({conversation_id:conv.id,user_id:me.id},{onConflict:'conversation_id,user_id',ignoreDuplicates:true});
  loadMessages(conv.id); subscribeMessages(conv.id); loadPinnedMessage(conv.id);
}

async function checkDisappearingMode(convId) {
  const { data: msg } = await sb.from('messages').select('disappears_at').eq('conversation_id',convId).not('disappears_at','is',null).limit(1);
  if (msg?.length) {
    const secs = Math.round((new Date(msg[0].disappears_at)-Date.now()+(60*1000))/1000);
    const label = secs<60?`${secs}s`:secs<3600?`${Math.round(secs/60)}m`:`${Math.round(secs/3600)}h`;
    if ($('disappear-bar')) $('disappear-bar').style.display='flex';
    if ($('disappear-label')) $('disappear-label').textContent = `Messages disappear after ~${label}`;
    if ($('disappear-select')) $('disappear-select').value = String(disappearSeconds);
  } else { if ($('disappear-bar')) $('disappear-bar').style.display='none'; }
}

function showChatUI(name, avatar) {
  $('home-feed').style.display='none';
  $('chat-placeholder').style.display='none'; $('active-chat').style.display='flex';
  
  // Update vertical navigation to highlight Messages
  document.querySelectorAll('.nav-item').forEach(b => {
    b.classList.toggle('active', b.dataset.panel === 'dms');
  });
  
  $('chat-hdr-name').textContent=name; renderAv($('chat-hdr-av'),avatar);
  $('messages-list').innerHTML=''; clearReply(); unsubChat(); editingMsgId=null;
  closeMsgSearch();
  if (window.innerWidth<=768) { $('sidebar').classList.remove('mob-open'); $('mob-overlay').classList.remove('show'); document.body.classList.remove('sidebar-open'); document.body.classList.add('chat-open'); window.scrollTo(0,0); }
}

function closeChat() {
  $('chat-placeholder').style.display='flex'; $('active-chat').style.display='none';
  currentChat=null; unsubChat(); document.body.classList.remove('chat-open');
  if (window.innerWidth<=768) { $('sidebar').classList.add('mob-open'); $('mob-overlay').classList.add('show'); document.body.classList.add('sidebar-open'); }
}

function unsubChat()  { chatSubs.forEach(s=>sb.removeChannel(s)); chatSubs=[]; }
function unsubAll()   { rtSubs.forEach(s=>sb.removeChannel(s)); rtSubs=[]; unsubChat(); }

function subscribePresence() {
  sb.from('users').update({online:true,last_seen:new Date().toISOString()}).eq('id',me.id);
  window.addEventListener('beforeunload', async ()=>{
    try {
      const { data: sessionData } = await sb.auth.getSession();
      const token = sessionData?.session?.access_token || SUPABASE_ANON;
      const body = JSON.stringify({online:false,last_seen:new Date().toISOString()});
      const url = `${SUPABASE_URL}/rest/v1/users?id=eq.${me.id}`;
      // Use fetch with keepalive as primary, sendBeacon as fallback
      try {
        fetch(url, { method:'PATCH', headers:{'Content-Type':'application/json','apikey':SUPABASE_ANON,'Authorization':'Bearer '+token,'Prefer':'return=minimal'}, body, keepalive:true });
      } catch(e) {
        navigator.sendBeacon(url, new Blob([body],{type:'application/json'}));
      }
    } catch(e) {}
  });
  const sub = sb.channel('presence')
    .on('postgres_changes',{event:'UPDATE',schema:'public',table:'users'},p=>{
      if (currentChat?.type==='dm'&&currentChat.otherId===p.new.id) {
        const u=p.new;
        $('chat-hdr-sub').textContent = u.last_seen_hidden?'': (u.online?'🟢 Online':'⚫ Last seen '+relTime(new Date(u.last_seen).getTime()));
      }
      // Refresh DM list to update online dots
      try { loadDMList(); } catch(e) {}
    }).subscribe();
  rtSubs.push(sub);
}

// ═══════════════════════════════════════════════════════════
//  MESSAGES
// ═══════════════════════════════════════════════════════════
async function loadMessages(convId) {
  const list = $('messages-list'); showSkeletonBubbles(list);
  const { data: msgs } = await sb.from('messages').select('*,reactions(*)').eq('conversation_id',convId).is('thread_parent_id', null).order('created_at',{ascending:true}).limit(100);
  list.innerHTML='';
  let lastDay=null;
  (msgs||[]).forEach(msg => {
    const day = new Date(msg.created_at).toDateString();
    if (day!==lastDay) { lastDay=day; const d=mk('div','date-divider'); d.textContent=day===new Date().toDateString()?'Today':day; list.appendChild(d); }
    list.appendChild(buildBubble(msg));
  });
  scrollBottom();
  // Mark read
  if (currentChat?.type==='dm') {
    await sb.from('conversation_members').update({unread_count:0}).eq('conversation_id',convId).eq('user_id',me.id);
    const { data: unread } = await sb.from('messages').select('id, read_by').eq('conversation_id', convId).neq('sender_id', me.id);
    if (unread?.length) {
      for (const msg of unread) {
        const readBy = msg.read_by || [];
        if (!readBy.includes(me.id)) {
          await sb.from('messages').update({ read_by: [...readBy, me.id] }).eq('id', msg.id);
        }
      }
    }
  }
}

function subscribeMessages(convId) {
  const sub = sb.channel('msgs-'+convId)
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'messages',filter:`conversation_id=eq.${convId}`},async p=>{
      const msg=p.new; if (msg.thread_parent_id) return;
      const {data:reactions}=await sb.from('reactions').select('*').eq('message_id',msg.id); msg.reactions=reactions||[];
      const list=$('messages-list');
      const day=new Date(msg.created_at).toDateString();
      const last=list.querySelector('.date-divider:last-of-type');
      if(!last||(last.textContent!=='Today'&&last.textContent!==day)){const d=mk('div','date-divider');d.textContent=day===new Date().toDateString()?'Today':day;list.appendChild(d);}
      list.appendChild(buildBubble(msg)); scrollBottom();
      if (msg.sender_id!==me.id) {
        if (notifSound) { const a=$('notif-sound'); if(a){a.currentTime=0;a.play().catch(()=>{});} }
        await sb.from('conversation_members').update({unread_count:0}).eq('conversation_id',convId).eq('user_id',me.id);
        // Mark delivered
        await sb.from('messages').update({delivered_to:msg.delivered_to?[...msg.delivered_to,me.id]:[me.id]}).eq('id',msg.id);
      }
      if (msg.disappears_at) scheduleDisappear(msg.id, new Date(msg.disappears_at));
    })
    .on('postgres_changes',{event:'UPDATE',schema:'public',table:'messages',filter:`conversation_id=eq.${convId}`},p=>{
      const row=document.querySelector(`.msg-row[data-id="${p.new.id}"]`);
      if(row){
        if(p.new.deleted){const b=row.querySelector('.bubble');if(b){b.classList.add('deleted');b.textContent='🚫 Message deleted';}}
        else{sb.from('reactions').select('*').eq('message_id',p.new.id).then(({data:r})=>{p.new.reactions=r||[];const newRow=buildBubble(p.new);row.replaceWith(newRow);});}
      }
    })
    .on('postgres_changes',{event:'*',schema:'public',table:'reactions'},()=>loadMessages(convId))
    .subscribe();
  chatSubs.push(sub);
}

function buildBubble(msg) {
  const isMe = msg.sender_id===me.id;
  const row = mk('div',`msg-row ${isMe?'me':'them'}`); row.dataset.id=msg.id;
  if (!isMe) { const av=mk('div','avatar'); av.style.cssText='width:26px;height:26px;font-size:.72rem;flex-shrink:0;margin-bottom:2px;'; renderAv(av,msg.sender_avatar||'?'); row.appendChild(av); }
  const wrap = mk('div','msg-wrap');
  if (!isMe&&currentChat?.type!=='dm') {
    const nameEl = mk('div','msg-name',esc(msg.sender_name||'?'));
    wrap.appendChild(nameEl);
  }
  const bubble = mk('div','bubble');
  if (msg.disappears_at&&!msg.deleted) { bubble.classList.add('disappearing'); const rem=Math.max(0,Math.round((new Date(msg.disappears_at)-Date.now())/1000)); bubble.innerHTML+=`<div class="disappear-timer">⏱${rem}s</div>`; }
  if (msg.deleted) { bubble.classList.add('deleted'); bubble.textContent='🚫 Message deleted'; }
  else {
    if (msg.reply_to_id) { const s=mk('div','reply-snip'); s.innerHTML=`<b>${esc(msg.reply_to_name||'?')}</b><br>${esc((msg.reply_to_text||'').slice(0,70))}`; bubble.appendChild(s); }
    if (msg.image_url) { const img=mk('img','bubble-img'); img.src=msg.image_url; img.alt='image'; img.onclick=()=>window.open(msg.image_url,'_blank'); bubble.appendChild(img); }
    if (msg.gif_url) { const img=mk('img','bubble-img'); img.src=msg.gif_url; img.alt='gif'; img.onclick=()=>window.open(msg.gif_url,'_blank'); bubble.appendChild(img); }
    if (msg.file_url) {
      const link=mk('a','bubble-file'); link.href=msg.file_url; link.target='_blank'; link.rel='noopener';
      link.innerHTML=`<div class="file-icon">📄</div><div class="file-info"><div class="file-name">${esc(msg.file_name||'File')}</div><div class="file-size">${fmtSize(msg.file_size||0)}</div></div>`;
      bubble.appendChild(link);
    }
    if (msg.voice_url) { bubble.appendChild(buildVoiceBubble(msg)); }
    else if (msg.text) { const s=mk('span'); s.innerHTML=formatMentions(msg.text); bubble.appendChild(s); }
    if (msg.edited) bubble.appendChild(mk('span','edited-lbl',' (edited)'));
  }
  bubble.addEventListener('contextmenu',e=>{e.preventDefault();contextTarget={msgId:msg.id,senderId:msg.sender_id,text:msg.text||'',senderName:msg.sender_name||'?'};showCtx(e.clientX,e.clientY,isMe&&!msg.deleted);});
  let lp; bubble.addEventListener('touchstart',e=>{lp=setTimeout(()=>{contextTarget={msgId:msg.id,senderId:msg.sender_id,text:msg.text||'',senderName:msg.sender_name||'?'};const t=e.touches[0];showCtx(t.clientX,t.clientY,isMe&&!msg.deleted);},500);});
  bubble.addEventListener('touchend',()=>clearTimeout(lp));
  wrap.appendChild(bubble);
  
  const meta=mk('div','msg-meta'); meta.appendChild(mk('span','msg-time',fmtTime(msg.created_at)));
  const isStarred = (msg.starred_by || []).includes(me.id);
  if (isStarred) {
    const star = mk('span', 'star-badge', '⭐');
    star.style.cssText = 'color:#f59e0b;font-size:0.75rem;margin-left:0.3rem;vertical-align:middle;';
    meta.appendChild(star);
  }
  if (isMe&&!msg.deleted) {
    const readArr=msg.read_by||[]; const delArr=msg.delivered_to||[];
    const hasRead=readArr.some(k=>k!==me.id); const hasDel=delArr.some(k=>k!==me.id);
    const tickClass = hasRead ? 'tick-read' : hasDel ? 'tick-delivered' : 'tick-sent';
    const tickSpan = mk('span', `msg-receipt ${tickClass}`);
    if (hasRead || hasDel) {
      tickSpan.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="vertical-align:middle;"><path d="M17 6L8.5 14.5L5 11M22 6L13.5 14.5L12 13"/></svg>`;
    } else {
      tickSpan.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="vertical-align:middle;"><polyline points="20 6 9 17 4 12"/></svg>`;
    }
    meta.appendChild(tickSpan);
  }
  wrap.appendChild(meta);
  
  const reactions=msg.reactions||[];
  if (reactions.length&&!msg.deleted) {
    const counts={}; reactions.forEach(r=>{if(!counts[r.emoji])counts[r.emoji]={emoji:r.emoji,uids:[]};counts[r.emoji].uids.push(r.user_id);});
    if (Object.keys(counts).length) {
      const rr=mk('div','reactions-row');
      Object.values(counts).forEach(r=>{const c=mk('button',`reac-chip${r.uids.includes(me.id)?' mine':''}`,`${r.emoji} ${r.uids.length}`);c.onclick=()=>toggleReaction(msg.id,r.emoji);rr.appendChild(c);});
      wrap.appendChild(rr);
    }
  }
  
  if (!isMe) {
    getUserMeta(msg.sender_id).then(meta => {
      const nameEl = wrap.querySelector('.msg-name');
      if (nameEl && !nameEl.querySelector('.badge-verified') && !nameEl.querySelector('.custom-status-badge')) {
        if (meta.is_verified) {
          const v = mk('span', 'badge-verified');
          v.innerHTML = '<svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
          nameEl.appendChild(v);
        }
        if (meta.badge && meta.badge !== 'none') {
          const cb = mk('span', 'custom-status-badge');
          cb.textContent = ' ' + meta.badge;
          cb.style.cssText = 'vertical-align:middle;font-size:0.75rem;';
          nameEl.appendChild(cb);
        }
        if (meta.role && meta.role !== 'user') {
          const r = mk('span', `badge-role ${meta.role}`, meta.role);
          nameEl.appendChild(r);
        }
      }
    });
  }
  
  row.appendChild(wrap); return row;
}

function buildVoiceBubble(msg) {
  const w = mk('div','voice-bubble');
  const playBtn = mk('button','vb-play-btn','▶');
  const waveform = mk('div','vb-waveform');
  const dur = msg.voice_duration||0;
  const timeEl = mk('span','vb-time', formatDuration(dur));
  // Build fake waveform bars
  const barCount = 30;
  for (let i=0;i<barCount;i++) {
    const b=mk('div','vb-bar'); b.style.height=`${4+Math.random()*18}px`; waveform.appendChild(b);
  }
  let audio=null, playing=false, progInterval=null;
  playBtn.onclick = () => {
    if (!audio) { audio=new Audio(msg.voice_url); audio.onended=()=>{playing=false;playBtn.textContent='▶';clearInterval(progInterval);Array.from(waveform.children).forEach(b=>b.classList.remove('played'));timeEl.textContent=formatDuration(dur);};  }
    if (playing) { audio.pause(); playing=false; playBtn.textContent='▶'; clearInterval(progInterval); }
    else { audio.play(); playing=true; playBtn.textContent='⏸';
      progInterval=setInterval(()=>{
        const prog=audio.currentTime/audio.duration;
        timeEl.textContent=formatDuration(Math.round(audio.currentTime));
        const bars=Array.from(waveform.children);
        bars.forEach((b,i)=>b.classList.toggle('played',i/bars.length<prog));
      },100);
    }
  };
  w.append(playBtn,waveform,timeEl); return w;
}

// ── SEND ──────────────────────────────────────────────────
async function sendMessage() {
  if (!currentChat||isSending) return;
  if (editingMsgId) {
    const text=$('msg-input').value.trim();
    if (text) { isSending=true; try { await sb.from('messages').update({text,edited:true}).eq('id',editingMsgId); } finally { isSending=false; } }
    editingMsgId=null; $('msg-input').value=''; autoResize($('msg-input')); return;
  }
  const text=$('msg-input').value.trim(); if (!text&&!replyTarget) return;
  if (text && checkProfanityFilter(text)) {
    toast('Message blocked: Profanity or spam detected! 🚫');
    await sb.from('reports').insert({ reporter_id: me.id, reported_id: me.id, reason: `Automated Moderation: Profanity/Spam filter triggered ("${text}")` });
    $('msg-input').value=''; autoResize($('msg-input')); return;
  }
  isSending=true; $('msg-input').value=''; autoResize($('msg-input'));
  try {
    const msgData = { conversation_id:currentChat.convId, sender_id:me.id, sender_name:myData.name||'Me', sender_avatar:myData.avatar||'?', text:text||null };
    if (replyTarget) { msgData.reply_to_id=replyTarget.id; msgData.reply_to_text=replyTarget.text; msgData.reply_to_name=replyTarget.senderName; clearReply(); }
    if (disappearSeconds>0) msgData.disappears_at = new Date(Date.now()+disappearSeconds*1000).toISOString();
    await sb.from('messages').insert(msgData);
    stopTyping();
    if (currentChat.type==='dm') await sb.from('conversation_members').update({unread_count:1}).eq('conversation_id',currentChat.convId).neq('user_id',me.id);
    loadDMList();
  } catch(err) { console.error(err); toast('Failed to send'); }
  finally { isSending=false; }
}

function msgConvId() { return currentChat?.convId; }

// ── File Upload ───────────────────────────────────────────
async function uploadFile(e) {
  const file=e.target.files[0]; if(!file||!currentChat) return;
  if (file.size>50*1024*1024) { toast('Max file size is 50 MB'); e.target.value=''; return; }
  const isImage = file.type.startsWith('image/');
  toast(isImage?'Uploading image…':'Uploading file…');
  try {
    const ext=file.name.split('.').pop().toLowerCase()||'bin';
    const path=`${currentChat.convId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const {error:upErr}=await sb.storage.from(BUCKET).upload(path,file,{contentType:file.type,upsert:true});
    if(upErr)throw upErr;
    const{data:{publicUrl}}=sb.storage.from(BUCKET).getPublicUrl(path);
    const msgData={conversation_id:currentChat.convId,sender_id:me.id,sender_name:myData.name||'Me',sender_avatar:myData.avatar||'?'};
    if(isImage) msgData.image_url=publicUrl;
    else { msgData.file_url=publicUrl; msgData.file_name=file.name; msgData.file_size=file.size; }
    if(disappearSeconds>0) msgData.disappears_at=new Date(Date.now()+disappearSeconds*1000).toISOString();
    await sb.from('messages').insert(msgData);
    e.target.value=''; toast(isImage?'Image sent ✓':'File sent ✓');
  }catch(err){console.error(err);toast('Upload failed: '+err.message);}
}

// ── GIF Search & Send ─────────────────────────────────────
async function searchGifs(q) {
  const grid = $('gif-grid');
  if (!q) { grid.innerHTML = '<div class="list-empty">Search for GIFs above</div>'; return; }
  grid.innerHTML = '<div class="list-empty">Searching...</div>';
  try {
    const res = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=cw5tWj6kr3Xq0F7aL8J24m07A2r2wW66&q=${encodeURIComponent(q)}&limit=12`);
    const json = await res.json();
    grid.innerHTML = '';
    if (!json.data || !json.data.length) {
      grid.innerHTML = '<div class="list-empty">No GIFs found</div>';
      return;
    }
    json.data.forEach(g => {
      const url = g.images.fixed_height.url;
      const item = mk('div', 'gif-item');
      item.innerHTML = `<img src="${url}" alt="gif"/>`;
      item.onclick = () => sendGif(url);
      grid.appendChild(item);
    });
  } catch(e) {
    grid.innerHTML = '<div class="list-empty">Failed to load GIFs</div>';
  }
}

async function sendGif(gifUrl) {
  if (!currentChat) return;
  const msgData = {
    conversation_id: currentChat.convId,
    sender_id: me.id,
    sender_name: myData.name || 'Me',
    sender_avatar: myData.avatar || '?',
    gif_url: gifUrl
  };
  if (disappearSeconds > 0) msgData.disappears_at = new Date(Date.now() + disappearSeconds * 1000).toISOString();
  await sb.from('messages').insert(msgData);
  $('gif-picker').style.display = 'none';
  $('gif-search').value = '';
  toast('GIF sent ✓');
}

// ── Typing ────────────────────────────────────────────────
function onTypingInput() {
  if (!currentChat||currentChat.type!=='dm') return;
  sb.from('typing').upsert({conversation_id:currentChat.convId,user_id:me.id,user_name:myData.name||'?',updated_at:new Date().toISOString()},{onConflict:'conversation_id,user_id'});
  clearTimeout(typingTimer); typingTimer=setTimeout(stopTyping,2500);
}
function stopTyping() { if(currentChat?.type==='dm') sb.from('typing').delete().eq('conversation_id',currentChat.convId).eq('user_id',me.id).then(()=>{}); }
function subscribeTyping(convId) {
  const sub=sb.channel('typing-'+convId)
    .on('postgres_changes',{event:'*',schema:'public',table:'typing',filter:`conversation_id=eq.${convId}`},async()=>{
      if(!currentChat||currentChat.convId!==convId) return;
      const{data}=await sb.from('typing').select('user_name').eq('conversation_id',convId).neq('user_id',me.id);
      const ti=$('typing-indicator');
      if(data?.length){ti.style.display='flex';$('typing-label').textContent=data[0].user_name+' is typing…';scrollBottom();}
      else ti.style.display='none';
    }).subscribe();
  chatSubs.push(sub);
}

// ── Voice Recording ───────────────────────────────────────
async function toggleVoiceRecord() {
  if (isRecording) { cancelVoiceRecord(); return; }
  if (!navigator.mediaDevices) { toast('Microphone not supported'); return; }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({audio:true});
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = []; recSeconds = 0;
    mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
    mediaRecorder.start(100);
    isRecording=true;
    const inputBar = $('msg-input').closest('.input-bar'); if (inputBar) inputBar.style.display='none';
    $('voice-recorder').style.display='flex';
    $('btn-voice').classList.add('recording');
    recInterval=setInterval(()=>{ recSeconds++; $('vr-timer').textContent=formatDuration(recSeconds); buildVRWave(); },1000);
  } catch(err) { toast('Cannot access microphone: '+err.message); }
}

function buildVRWave() {
  const w=$('vr-bars'); if(!w) return; w.innerHTML='';
  for(let i=0;i<20;i++){ const b=mk('div','vr-bar'); b.style.height=`${4+Math.random()*20}px`; b.style.animationDelay=`${i*0.08}s`; w.appendChild(b); }
}

function cancelVoiceRecord() {
  if (mediaRecorder&&isRecording) { mediaRecorder.stop(); mediaRecorder.stream.getTracks().forEach(t=>t.stop()); }
  isRecording=false; clearInterval(recInterval);
  $('voice-recorder').style.display='none'; const ib1 = $('msg-input').closest('.input-bar'); if (ib1) ib1.style.display='flex'; $('btn-voice').classList.remove('recording');
}

async function sendVoiceMessage() {
  if (!mediaRecorder||!isRecording) return;
  mediaRecorder.stop();
  mediaRecorder.stream.getTracks().forEach(t=>t.stop());
  isRecording=false; clearInterval(recInterval);
  await new Promise(r=>setTimeout(r,200));
  const blob=new Blob(audioChunks,{type:'audio/webm'});
  const path=`${currentChat.convId}/voice_${Date.now()}.webm`;
  $('voice-recorder').style.display='none'; const ib2 = $('msg-input').closest('.input-bar'); if (ib2) ib2.style.display='flex'; $('btn-voice').classList.remove('recording');
  toast('Sending voice message…');
  try {
    const{error}=await sb.storage.from(BUCKET).upload(path,blob,{contentType:'audio/webm',upsert:true});
    if(error)throw error;
    const{data:{publicUrl}}=sb.storage.from(BUCKET).getPublicUrl(path);
    await sb.from('messages').insert({conversation_id:currentChat.convId,sender_id:me.id,sender_name:myData.name||'Me',sender_avatar:myData.avatar||'?',voice_url:publicUrl,voice_duration:recSeconds});
    toast('Voice message sent ✓');
  }catch(err){toast('Failed to send voice: '+err.message);}
}

// ── Pinned Messages ───────────────────────────────────────
async function loadPinnedMessage(convId) {
  const{data}=await sb.from('pinned_messages').select('message_id,messages(text,voice_url,image_url)').eq('conversation_id',convId).order('pinned_at',{ascending:false}).limit(1);
  const bar=$('pinned-bar');
  if(!data?.length){bar.style.display='none';return;}
  const msg=data[0].messages;
  bar.style.display='flex';
  $('pin-text').textContent=msg?.text||'Image'||(msg?.voice_url?'Voice message':'Pinned message');
  $('pinned-bar').dataset.msgId=data[0].message_id;
}

async function unpinMessage() {
  if (!currentChat) return;
  const msgId=$('pinned-bar').dataset.msgId;
  await sb.from('pinned_messages').delete().eq('conversation_id',currentChat.convId).eq('message_id',msgId);
  await sb.from('messages').update({is_pinned:false}).eq('id',msgId);
  $('pinned-bar').style.display='none';
}

async function doPinMsg() {
  hideCtx(); if(!contextTarget||!currentChat) return;
  await sb.from('pinned_messages').upsert({conversation_id:currentChat.convId,message_id:contextTarget.msgId,pinned_by:me.id},{onConflict:'conversation_id,message_id',ignoreDuplicates:true});
  await sb.from('messages').update({is_pinned:true}).eq('id',contextTarget.msgId);
  loadPinnedMessage(currentChat.convId); toast('Message pinned');
}

// ── Message Search ────────────────────────────────────────
function toggleMsgSearch() { const b=$('msg-search-bar'); b.style.display=b.style.display==='none'?'flex':'none'; if(b.style.display==='flex') $('msg-search-input').focus(); }
function closeMsgSearch() { $('msg-search-bar').style.display='none'; document.querySelectorAll('.bubble.search-highlight').forEach(b=>b.classList.remove('search-highlight')); msgSearchResults=[]; $('msg-search-count').textContent=''; }

async function runMsgSearch(q) {
  document.querySelectorAll('.bubble.search-highlight').forEach(b=>b.classList.remove('search-highlight'));
  if(!q||!currentChat){$('msg-search-count').textContent='';return;}
  const{data}=await sb.from('messages').select('id,text').eq('conversation_id',currentChat.convId).ilike('text','%'+q+'%').order('created_at',{ascending:false});
  msgSearchResults=(data||[]).map(m=>m.id); msgSearchIdx=0;
  $('msg-search-count').textContent=`${msgSearchResults.length} result${msgSearchResults.length!==1?'s':''}`;
  if(msgSearchResults.length) highlightSearchResult();
}

function navMsgSearch(dir) { msgSearchIdx=((msgSearchIdx+dir)+msgSearchResults.length)%msgSearchResults.length; highlightSearchResult(); }
function highlightSearchResult() {
  document.querySelectorAll('.bubble.search-highlight').forEach(b=>b.classList.remove('search-highlight'));
  const id=msgSearchResults[msgSearchIdx];
  const row=document.querySelector(`.msg-row[data-id="${id}"]`);
  if(row){const b=row.querySelector('.bubble');if(b){b.classList.add('search-highlight');b.scrollIntoView({behavior:'smooth',block:'center'});}}
}

// ── Disappearing Messages ─────────────────────────────────
function startDisappearChecker() {
  setInterval(async()=>{
    if(!currentChat) return;
    const now=new Date().toISOString();
    const{data}=await sb.from('messages').select('id').eq('conversation_id',currentChat.convId).not('disappears_at','is',null).lt('disappears_at',now);
    if(data?.length){ for(const m of data) await sb.from('messages').update({deleted:true,text:'',disappears_at:null}).eq('id',m.id); }
  },5000);
}

async function setDisappear(secs) {
  disappearSeconds=secs;
  localStorage.setItem('ph_disappear',String(secs));
  if($('disappear-select')) $('disappear-select').value=String(secs);
  if(secs>0){ if($('disappear-bar')) $('disappear-bar').style.display='flex'; if($('disappear-label')) $('disappear-label').textContent=`Messages disappear after ${formatDuration(secs)}`; }
  else { if($('disappear-bar')) $('disappear-bar').style.display='none'; }
}

async function setMsgDisappear(msgId, secs) {
  if(!msgId) return;
  const t = secs>0 ? new Date(Date.now()+secs*1000).toISOString() : null;
  await sb.from('messages').update({disappears_at:t}).eq('id',msgId);
  toast(secs>0?`Message will disappear in ${formatDuration(secs)}`:'Disappear timer removed');
}

function scheduleDisappear(msgId, expiresAt) {
  const ms = expiresAt-Date.now();
  if(ms>0) setTimeout(async()=>{ await sb.from('messages').update({deleted:true,text:'',disappears_at:null}).eq('id',msgId); },ms);
}

// ── Context Menu ──────────────────────────────────────────
function showCtx(x,y,canEdit){const cm=$('ctx-menu');$('ctx-edit').style.display=canEdit?'block':'none';$('ctx-delete').style.display=canEdit?'block':'none';cm.style.left=Math.min(x,window.innerWidth-180)+'px';cm.style.top=Math.min(y,window.innerHeight-220)+'px';cm.style.display='block';}
function hideCtx(){$('ctx-menu').style.display='none';}
function doReply(){hideCtx();if(!contextTarget)return;replyTarget={id:contextTarget.msgId,senderName:contextTarget.senderName,text:contextTarget.text};$('rp-name').textContent=contextTarget.senderName;$('rp-text').textContent=contextTarget.text;$('reply-preview').style.display='flex';$('msg-input').focus();}
function doCopy(){hideCtx();if(contextTarget?.text)navigator.clipboard.writeText(contextTarget.text).then(()=>toast('Copied'));}
function doEdit(){hideCtx();if(!contextTarget)return;editingMsgId=contextTarget.msgId;$('msg-input').value=contextTarget.text;$('msg-input').focus();autoResize($('msg-input'));}
async function doDelete(){hideCtx();if(!contextTarget)return;await sb.from('messages').update({deleted:true,text:null}).eq('id',contextTarget.msgId);}
function clearReply(){replyTarget=null;$('reply-preview').style.display='none';}
function autoResize(el){el.style.height='auto';el.style.height=Math.min(el.scrollHeight,110)+'px';}

// ── Reactions ─────────────────────────────────────────────
async function toggleReaction(msgId,emoji){
  const{data:ex}=await sb.from('reactions').select('id,emoji').eq('message_id',msgId).eq('user_id',me.id).maybeSingle();
  if(ex){if(ex.emoji===emoji)await sb.from('reactions').delete().eq('id',ex.id);else await sb.from('reactions').update({emoji}).eq('id',ex.id);}
  else await sb.from('reactions').insert({message_id:msgId,user_id:me.id,emoji});
}

const STICKERS = [
  { name: 'Happy Ghost', url: 'https://img.icons8.com/color/96/000000/cute-ghost.png' },
  { name: 'Flying Ghost', url: 'https://img.icons8.com/color/96/000000/flying-ghost.png' },
  { name: 'Shocked Ghost', url: 'https://img.icons8.com/external-flaticons-flat-flat-icons/64/000000/external-ghost-halloween-flaticons-flat-flat-icons.png' },
  { name: 'Winking Ghost', url: 'https://img.icons8.com/external-flaticons-flat-flat-icons/64/000000/external-ghost-halloween-flaticons-flat-flat-icons-2.png' },
  { name: 'Spooky Spirit', url: 'https://img.icons8.com/color/96/000000/ghost.png' },
  { name: 'Devil Ghost', url: 'https://img.icons8.com/external-flat-icons-maxicons/85/000000/external-ghost-halloween-flat-icons-maxicons.png' }
];

function toggleEmoji(){
  const ep = $('emoji-picker');
  emojiOpen = !emojiOpen;
  ep.style.display = emojiOpen ? 'flex' : 'none';
  
  if (emojiOpen) {
    const tabEmo = $('ep-tab-emojis');
    const tabStk = $('ep-tab-stickers');
    const listEmo = $('ep-emojis-list');
    const listStk = $('ep-stickers-list');
    
    tabEmo.onclick = () => {
      tabEmo.style.background = 'rgba(255,255,255,0.1)';
      tabEmo.style.color = 'var(--text)';
      tabStk.style.background = 'none';
      tabStk.style.color = 'var(--text3)';
      listEmo.style.display = 'flex';
      listStk.style.display = 'none';
    };
    
    tabStk.onclick = () => {
      tabStk.style.background = 'rgba(255,255,255,0.1)';
      tabStk.style.color = 'var(--text)';
      tabEmo.style.background = 'none';
      tabEmo.style.color = 'var(--text3)';
      listEmo.style.display = 'none';
      listStk.style.display = 'flex';
    };
    
    if (!listEmo.children.length) {
      EMOJIS.forEach(e => {
        const b = mk('button', 'emoji-btn', e);
        b.onclick = () => {
          const inp = $('msg-input');
          const st = inp.selectionStart || inp.value.length, en = inp.selectionEnd || inp.value.length;
          inp.value = inp.value.substring(0, st) + e + inp.value.substring(en);
          inp.selectionStart = inp.selectionEnd = st + e.length;
          inp.focus();
          autoResize(inp);
          ep.style.display = 'none';
          emojiOpen = false;
        };
        listEmo.appendChild(b);
      });
    }
    
    if (!listStk.children.length) {
      STICKERS.forEach(s => {
        const b = mk('button', 'sticker-option-btn');
        b.style.cssText = 'border:none;background:none;padding:.2rem;cursor:pointer;';
        const img = mk('img');
        img.src = s.url;
        img.alt = s.name;
        img.style.cssText = 'width:42px;height:42px;object-fit:contain;';
        b.appendChild(img);
        b.onclick = () => sendSticker(s.url);
        listStk.appendChild(b);
      });
    }
  }
}

async function sendSticker(url) {
  if (!currentChat) return;
  const msgData = {
    conversation_id: currentChat.convId,
    sender_id: me.id,
    sender_name: myData.name || 'Me',
    sender_avatar: myData.avatar || '?',
    image_url: url,
    read_by: [me.id],
    delivered_to: [me.id]
  };
  if (disappearSeconds > 0) msgData.disappears_at = new Date(Date.now() + disappearSeconds * 1000).toISOString();
  await sb.from('messages').insert(msgData);
  $('emoji-picker').style.display = 'none';
  emojiOpen = false;
}

// ── Info Panel ────────────────────────────────────────────
async function toggleInfo(){
  const panel=$('info-panel');
  if(panel.style.display!=='none'){panel.style.display='none';return;}
  if(!currentChat)return;
  panel.style.display='flex';const body=$('info-panel-body');body.innerHTML='';
  if(currentChat.type==='dm'){
    const{data:u}=await sb.from('users').select('*').eq('id',currentChat.otherId).single();
    if(u){
      body.innerHTML=`
        <div style="text-align:center;padding:.5rem 0 1rem;">
          <div id="info-avatar-big" style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,var(--acc),var(--acc2));display:flex;align-items:center;justify-content:center;font-size:1.8rem;color:#fff;margin:0 auto .5rem;overflow:hidden;"></div>
          <div style="font-size:1rem;font-weight:700;">${esc(u.name||'?')}</div>
          <div style="font-size:.75rem;color:var(--text3);">${u.username?'@'+esc(u.username):''}</div>
          ${u.bio?`<div style="font-size:.8rem;color:var(--text2);margin-top:.4rem;padding:0 .5rem;">${esc(u.bio)}</div>`:''}
        </div>
        <div class="info-sec-title">Status</div>
        <div style="font-size:.82rem;color:var(--text2);">${esc(u.status||'Available')}</div>
        <div class="info-sec-title">Email</div>
        <div style="font-size:.82rem;color:var(--text2);">${esc(u.email||'')}</div>
        <div class="info-sec-title">Actions</div>
        <button class="freq-btn decline" style="width:100%;margin-top:.3rem;" onclick="reportUser('${u.id}','${esc(u.name||'?')}')">🚩 Report</button>
        <button class="freq-btn" style="width:100%;margin-top:.4rem;background:rgba(239,68,68,.1);color:var(--danger);border:1px solid rgba(239,68,68,.2);" onclick="blockUser('${u.id}','${esc(u.name||'?')}')">🚫 Block</button>
      `;
      renderAv(body.querySelector('#info-avatar-big'), u.avatar||'?');
    }
  } else {
    body.appendChild(mk('div','info-sec-title','Members'));
    const{data:members}=await sb.from('conversation_members').select('user_id,role,users(*)').eq('conversation_id',currentChat.convId);
    (members||[]).forEach(m=>{
      const u=m.users;if(!u)return;
      const item=mk('div','info-member-item');
      const av=mk('div','avatar');renderAv(av,u.avatar||'?');av.style.cssText='width:32px;height:32px;font-size:.9rem;flex-shrink:0;';
      const info=mk('div','');info.style.cssText='flex:1;min-width:0;';
      info.innerHTML=`<div class="info-m-name">${esc(u.name||'?')}</div><div class="info-m-role">${m.role}</div>`;
      item.append(av,info);body.appendChild(item);
    });
  }
  await loadStarredMessages(currentChat.convId, body);
  if(window.innerWidth<=768)$('mob-overlay').classList.add('show');
}

// ═══════════════════════════════════════════════════════════
//  ROOMS & GROUPS
// ═══════════════════════════════════════════════════════════
async function createRoom(){
  const name=$('room-name-in').value.trim();if(!name){toast('Enter a room name');return;}
  const tags = $('room-tags-in') ? $('room-tags-in').value.trim() : '';
  const isPrivate = $('room-private-in') ? $('room-private-in').checked : false;
  const{data:conv,error}=await sb.from('conversations').insert({
    type:'room',
    name,
    description:$('room-desc-in').value.trim(),
    tags,
    is_private:isPrivate,
    created_by:me.id
  }).select().single();
  if(error){toast('Error: '+error.message);return;}
  await sb.from('conversation_members').insert({conversation_id:conv.id,user_id:me.id,role:'admin'});
  $('room-name-in').value='';$('room-desc-in').value='';
  if($('room-tags-in'))$('room-tags-in').value='';
  if($('room-private-in'))$('room-private-in').checked=false;
  closeModal('create-room-modal');toast('Room created!');loadRooms();
}

async function openCreateGroupModal(){
  groupMemberIds=[];$('sel-members').innerHTML='';$('group-name-in').value='';if($('gm-search'))$('gm-search').value='';
  openModal('create-group-modal');loadGroupUserList('');
}

async function loadGroupUserList(q){
  const res=$('gm-results');res.innerHTML='<div class="list-empty" style="padding:.4rem;">Loading…</div>';
  let query=sb.from('users').select('*').neq('id',me.id).limit(20);
  if(q)query=query.or(`name.ilike.%${q}%,username.ilike.%${q}%`);
  const{data:users}=await query;res.innerHTML='';
  if(!users?.length){res.innerHTML='<div class="list-empty">No users found.</div>';return;}
  users.forEach(u=>{
    const already=groupMemberIds.includes(u.id);
    const item=buildChatItem({avatar:u.avatar||'?',name:u.name||'?',preview:u.username?'@'+u.username:'',time:'',unread:0,online:!!u.online});
    item.style.cssText='padding:.4rem .6rem;border-radius:10px;cursor:pointer;';
    if(already){item.style.opacity='.4';item.style.pointerEvents='none';}
    item.onclick=()=>addGroupMember(u.id,u.name||'?',item);res.appendChild(item);
  });
}

function addGroupMember(uid,name,el){
  if(groupMemberIds.includes(uid))return;groupMemberIds.push(uid);
  if(el){el.style.opacity='.4';el.style.pointerEvents='none';}
  const chip=mk('span','sel-chip',esc(name));
  const rm=mk('button','','✕');rm.onclick=()=>{groupMemberIds=groupMemberIds.filter(i=>i!==uid);chip.remove();if(el){el.style.opacity='';el.style.pointerEvents='';}};
  chip.appendChild(rm);$('sel-members').appendChild(chip);
}

async function createGroup(){
  const name=$('group-name-in').value.trim();if(!name){toast('Enter a group name');return;}
  if(!groupMemberIds.length){toast('Add at least one member');return;}
  const isPrivate = $('group-private-in') ? $('group-private-in').checked : false;
  const{data:conv,error}=await sb.from('conversations').insert({
    type:'group',
    name,
    icon:'👥',
    is_private:isPrivate,
    created_by:me.id
  }).select().single();
  if(error){toast('Error: '+error.message);return;}
  const members=[{conversation_id:conv.id,user_id:me.id,role:'admin'},...groupMemberIds.map(uid=>({conversation_id:conv.id,user_id:uid,role:'member'}))];
  await sb.from('conversation_members').insert(members);
  if($('group-private-in'))$('group-private-in').checked=false;
  closeModal('create-group-modal');toast('Group created!');loadGroups();
}

// ═══════════════════════════════════════════════════════════
//  SIDEBAR PANELS
// ═══════════════════════════════════════════════════════════
function switchPanel(panel){
  document.querySelectorAll('.snav-btn').forEach(b=>b.classList.toggle('active',b.dataset.panel===panel));
  document.querySelectorAll('.sidebar-panel').forEach(p=>p.classList.remove('active'));
  $(`panel-${panel}`).classList.add('active');
}

// ═══════════════════════════════════════════════════════════
//  SKELETON LOADERS
// ═══════════════════════════════════════════════════════════
function showSkeleton(el, count=4) {
  el.innerHTML='';
  for(let i=0;i<count;i++){
    const s=mk('div','skeleton-item');
    const av=mk('div','sk-av');
    const lines=mk('div','sk-lines');
    lines.appendChild(mk('div','sk-line'));
    lines.appendChild(mk('div','sk-line short'));
    s.append(av,lines);el.appendChild(s);
  }
}
function showSkeletonBubbles(el) {
  el.innerHTML='';
  const container = mk('div','skeleton-bubble');
  const sides=['them','me','them','me','them'];
  sides.forEach(s=>{
    const b=mk('div',s==='me'?'sk-bubble me':'sk-bubble');
    b.style.width=`${120+Math.random()*100}px`;
    container.appendChild(b);
  });
  el.appendChild(container);
}

// ═══════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════

function buildChatItem({avatar,name,preview,time,unread,online}){
  const item=mk('div','chat-item');
  const aw=mk('div','avatar-wrap');const av=mk('div','avatar');renderAv(av,avatar);av.style.cssText='width:40px;height:40px;font-size:1.1rem;flex-shrink:0;';
  const dot=mk('div',online?'online-dot':'online-dot offline-dot');aw.append(av,dot);
  const info=mk('div','ci-info');info.innerHTML=`<div class="ci-name">${esc(name)}</div><div class="ci-prev">${esc(preview)}</div>`;
  const meta=mk('div','ci-meta');
  if(time)meta.innerHTML+=`<span class="ci-time">${time}</span>`;
  if(unread)meta.innerHTML+=`<span class="unread-badge">${unread}</span>`;
  item.append(aw,info,meta);return item;
}
function renderAv(el,avatar){
  if(!el)return;
  if(typeof avatar==='string'&&(avatar.startsWith('http')||avatar.startsWith('https')||avatar.startsWith('data:image/'))){
    el.innerHTML=`<img src="${avatar}" alt="av" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"/>`;
    el.style.background='none';
  } else if (avatar === '🏠') {
    el.innerHTML = '<i data-lucide="compass"></i>';
    el.style.background = 'var(--acc)';
    if (window.lucide) lucide.createIcons();
  } else if (avatar === '👥' || avatar === '👤') {
    el.innerHTML = '<i data-lucide="users"></i>';
    el.style.background = 'var(--acc)';
    if (window.lucide) lucide.createIcons();
  } else {
    el.innerHTML = '<i data-lucide="user" style="width:50%;height:50%;color:var(--text3);"></i>';
    el.style.background = 'var(--surface2)';
    el.style.display = 'flex';
    el.style.alignItems = 'center';
    el.style.justifyContent = 'center';
    if (window.lucide) lucide.createIcons();
  }
}
function openModal(id){$(id).style.display='flex';}
function closeModal(id){$(id).style.display='none';}
function closeAllModals(){document.querySelectorAll('.modal-backdrop').forEach(m=>m.style.display='none');}
function scrollBottom(){const m=$('messages-area');requestAnimationFrame(()=>m.scrollTop=m.scrollHeight);}
function fmtTime(ts){if(!ts)return'';return new Date(ts).toLocaleTimeString('en',{hour:'2-digit',minute:'2-digit',hour12:true});}
function relTime(ts){const s=(Date.now()-ts)/1000;if(s<60)return'now';if(s<3600)return Math.floor(s/60)+'m ago';if(s<86400)return Math.floor(s/3600)+'h ago';return new Date(ts).toLocaleDateString('en',{month:'short',day:'numeric'});}
function formatDuration(s){const m=Math.floor(s/60);const sec=s%60;return`${m}:${String(sec).padStart(2,'0')}`;}
function fmtSize(b){if(b<1024)return b+'B';if(b<1024*1024)return(b/1024).toFixed(1)+'KB';return(b/(1024*1024)).toFixed(1)+'MB';}
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
let toastTimer;
function toast(msg){const t=$('toast');t.textContent=msg;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),2500);}

// ═══════════════════════════════════════════════════════════
//  INSTAGRAM FEED & NAVIGATION LOGIC
// ═══════════════════════════════════════════════════════════
async function switchFeedOrChat(panel) {
  const isFeed = panel === 'feed';
  
  // Highlight desktop nav
  document.querySelectorAll('.nav-sidebar .nav-item').forEach(b => {
    b.classList.toggle('active', b.dataset.panel === panel);
  });
  
  // Highlight mobile bottom nav
  document.querySelectorAll('.mob-bottom-nav .mbn-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.panel === panel);
  });
  
  if (isFeed) {
    $('sidebar').style.display = 'none';
    $('chat-placeholder').style.display = 'none';
    $('active-chat').style.display = 'none';
    $('home-feed').style.display = 'flex';
    
    // Render creator profile avatar in create post card
    renderAv($('create-post-av'), myData.avatar || '?');
    
    // Load data
    loadFeedStories();
    loadFeedPosts();
    loadFeedSuggestions();
    
    // Reset mobile state
    document.body.classList.remove('chat-open');
    document.body.classList.remove('sidebar-open');
    $('sidebar').classList.remove('mob-open');
    $('mob-overlay').classList.remove('show');
  } else {
    $('home-feed').style.display = 'none';
    $('sidebar').style.display = 'flex';
    
    if (window.innerWidth > 768) {
      if (!currentChat) {
        $('chat-placeholder').style.display = 'flex';
        $('active-chat').style.display = 'none';
      } else {
        $('chat-placeholder').style.display = 'none';
        $('active-chat').style.display = 'flex';
      }
    } else {
      // Mobile overlays sidebar panel
      $('sidebar').classList.add('mob-open');
      $('mob-overlay').classList.add('show');
      document.body.classList.add('sidebar-open');
      
      $('chat-placeholder').style.display = 'none';
      $('active-chat').style.display = 'none';
    }
    switchPanel(panel);
  }
  
  if (window.lucide) lucide.createIcons();
}

async function loadFeedStories() {
  const container = $('feed-stories-list');
  if (!container) return;
  container.innerHTML = '';
  
  const now = new Date().toISOString();
  const { data: stories } = await sb.from('stories')
    .select('*, users(*)')
    .gt('expires_at', now)
    .order('created_at', { ascending: false });
    
  if (!stories?.length) {
    container.innerHTML = '<span style="font-size:0.75rem;color:var(--text3);padding-left:0.5rem;">No stories posted yet.</span>';
    return;
  }
  
  // Group stories by user
  const byUser = {};
  stories.forEach(s => {
    if (!byUser[s.user_id]) byUser[s.user_id] = [];
    byUser[s.user_id].push(s);
  });
  
  for (const [uid, userStories] of Object.entries(byUser)) {
    const u = userStories[0].users || {};
    const { data: viewed } = await sb.from('story_views').select('story_id').eq('viewer_id', me.id);
    const viewedIds = new Set((viewed || []).map(v => v.story_id));
    const allViewed = userStories.every(s => viewedIds.has(s.id));
    
    const item = mk('div', 'story-item');
    const ring = mk('div', `story-ring${allViewed ? ' seen' : ''}`);
    const av = mk('div', 'story-av');
    renderAv(av, u.avatar || '?');
    ring.appendChild(av);
    
    const name = mk('div', 'story-uname', esc((u.name || '?').split(' ')[0]));
    item.append(ring, name);
    item.onclick = () => openStoryViewer(userStories, u);
    container.appendChild(item);
  }
  
  if (window.lucide) lucide.createIcons();
}

async function loadFeedSuggestions() {
  const container = $('feed-right-suggestions-list');
  if (!container) return;

  // Update current user profile details in feed right sidebar
  if ($('feed-right-my-avatar')) renderAv($('feed-right-my-avatar'), myData.avatar || '?');
  if ($('feed-right-my-username')) $('feed-right-my-username').textContent = myData.username ? '@' + myData.username : (me ? me.email || 'user' : 'user');
  if ($('feed-right-my-name')) $('feed-right-my-name').textContent = myData.name || 'Me';
  if ($('feed-right-switch-btn')) {
    $('feed-right-switch-btn').onclick = () => {
      openModal('profile-modal');
    };
  }
  
  // Fetch up to 5 users that are not myself and not currently friends
  const { data: users, error } = await sb.from('users')
    .select('id, name, username, avatar')
    .neq('id', me.id)
    .limit(5);
    
  if (error || !users || users.length === 0) {
    container.innerHTML = '<span style="font-size:0.74rem;color:var(--text3);padding-left:0.5rem;">No suggestions at this time</span>';
    return;
  }
  
  container.innerHTML = '';
  users.forEach(u => {
    const item = mk('div', 'feed-right-suggest-item');
    const av = mk('div', 'avatar');
    renderAv(av, u.avatar || '?');
    
    const info = mk('div', 'feed-right-suggest-info');
    const uname = mk('div', 'feed-right-suggest-username', `@${u.username || 'user'}`);
    const subtitle = mk('div', 'feed-right-suggest-subtitle', u.name || 'Suggested User');
    info.append(uname, subtitle);
    
    const act = mk('button', 'feed-right-suggest-action', 'Follow');
    act.onclick = async () => {
      act.disabled = true;
      act.textContent = 'Adding...';
      const { error: addErr } = await sb.from('friends').insert({ user_id: me.id, friend_id: u.id, status: 'pending' });
      if (addErr) {
        toast('Failed to follow: ' + addErr.message);
        act.disabled = false;
        act.textContent = 'Follow';
      } else {
        toast('Friend request sent! ✉️');
        act.textContent = 'Requested';
        act.style.color = 'var(--text3)';
        act.onclick = null;
      }
    };
    
    item.append(av, info, act);
    container.appendChild(item);
  });
}

async function loadFeedPosts() {
  const container = $('feed-posts-list');
  if (!container) return;
  showSkeleton(container, 3);
  
  const { data: posts, error } = await sb.from('build_posts')
    .select('*, users(id, name, username, avatar), build_likes(user_id), build_comments(*, users(name, username))')
    .order('created_at', { ascending: false });
  container.innerHTML = '';
    
  if (error) {
    container.innerHTML = `<div class="list-empty">Failed to load posts. Error: ${error.message}</div>`;
    return;
  }
  
  if (!posts || posts.length === 0) {
    container.innerHTML = `
      <div class="list-empty">
        <span style="font-size:2.2rem;"><i data-lucide="ghost"></i></span>
        <div style="font-weight:600;margin-top:0.5rem;color:var(--text2);">The Feed is Quiet</div>
        <div style="font-size:0.8rem;color:var(--text3);margin-top:0.2rem;">Be the first to share an update or community build log!</div>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }
  
  container.innerHTML = '';
  posts.forEach(post => {
    const u = post.users || {};
    const likes = post.build_likes || [];
    const isLiked = likes.some(l => l.user_id === me.id);
    const comments = post.build_comments || [];
    
    const card = mk('div', 'feed-post-card');
    
    // Header
    const hdr = mk('div', 'post-hdr');
    const av = mk('div', 'avatar');
    renderAv(av, u.avatar || '?');
    const info = mk('div', 'post-hdr-info');
    const name = mk('div', 'post-hdr-name', esc(u.name || 'User'));
    const meta = mk('div', 'post-hdr-meta', `@${u.username || 'user'} · ${relTime(new Date(post.created_at).getTime())}`);
    info.append(name, meta);
    hdr.append(av, info);
    card.appendChild(hdr);
    
    // Caption/Text
    if (post.text_content) {
      const cap = mk('div', 'post-caption', esc(post.text_content));
      card.appendChild(cap);
    }
    
    // Media (Image)
    if (post.media_url) {
      const mediaDiv = mk('div', 'post-media');
      const img = mk('img', '');
      img.src = post.media_url;
      img.alt = 'post media';
      mediaDiv.appendChild(img);
      card.appendChild(mediaDiv);
    }
    
    // Action bar
    const actions = mk('div', 'post-actions');
    
    // Like button
    const likeBtn = mk('div', `post-action-btn${isLiked ? ' liked' : ''}`);
    likeBtn.innerHTML = `<span>${isLiked ? '❤️' : '🤍'}</span> <span>${likes.length} ${likes.length === 1 ? 'like' : 'likes'}</span>`;
    likeBtn.onclick = () => toggleLikePost(post.id, isLiked);
    
    // Comment button/indicator
    const commBtn = mk('div', 'post-action-btn');
    commBtn.innerHTML = `<span><i data-lucide="message-square"></i></span> <span>${comments.length} ${comments.length === 1 ? 'comment' : 'comments'}</span>`;
    
    actions.append(likeBtn, commBtn);
    card.appendChild(actions);
    
    // Comments section
    const commentsSec = mk('div', 'post-comments-sec');
    
    // List comments
    const commentsListDiv = mk('div', 'post-comments-list');
    comments.slice(0, 5).forEach(c => {
      const cUser = c.users || {};
      const item = mk('div', 'post-comment-item');
      item.innerHTML = `<span class="comment-user">@${cUser.username || 'user'}:</span><span class="comment-text">${esc(c.text)}</span>`;
      commentsListDiv.appendChild(item);
    });
    commentsSec.appendChild(commentsListDiv);
    
    // Comment input wrap
    const inputWrap = mk('div', 'post-comment-input-wrap');
    const input = mk('input', '');
    input.placeholder = 'Add a comment...';
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') submitComment(post.id, input.value.trim());
    });
    
    const sendBtn = mk('button', '', 'Post');
    sendBtn.onclick = () => submitComment(post.id, input.value.trim());
    
    inputWrap.append(input, sendBtn);
    commentsSec.appendChild(inputWrap);
    
    card.appendChild(commentsSec);
    container.appendChild(card);
  });
  
  if (window.lucide) lucide.createIcons();
}

async function toggleLikePost(postId, currentlyLiked) {
  if (currentlyLiked) {
    await sb.from('build_likes').delete().eq('post_id', postId).eq('user_id', me.id);
  } else {
    await sb.from('build_likes').insert({ post_id: postId, user_id: me.id });
  }
  loadFeedPosts();
}

async function submitComment(postId, text) {
  if (!text) return;
  const { error } = await sb.from('build_comments').insert({ post_id: postId, user_id: me.id, text });
  if (error) {
    toast('Error posting comment: ' + error.message);
  } else {
    loadFeedPosts();
  }
}

async function getOrCreatePostTarget() {
  // Try to find any channel of type 'build_log'
  const { data: chan } = await sb.from('channels').select('id, phantom_id').eq('type', 'build_log').limit(1).maybeSingle();
  if (chan) return chan;
  
  // Try to find ANY channel
  const { data: anyChan } = await sb.from('channels').select('id, phantom_id').limit(1).maybeSingle();
  if (anyChan) return anyChan;
  
  // Create a default phantom and channel
  let phantomId;
  const { data: ph } = await sb.from('phantoms').select('id').eq('name', 'Lobby').limit(1).maybeSingle();
  if (ph) {
    phantomId = ph.id;
  } else {
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 100);
    const { data: newPh, error: phErr } = await sb.from('phantoms').insert({
      name: 'Lobby',
      description: 'Global community lobby',
      expires_at: expiresAt.toISOString(),
      created_by: me.id
    }).select().single();
    if (phErr) throw phErr;
    phantomId = newPh.id;
    
    await sb.from('phantom_members').insert({
      phantom_id: phantomId,
      user_id: me.id,
      role: 'admin'
    });
  }
  
  const { data: newChan, error: chanErr } = await sb.from('channels').insert({
    phantom_id: phantomId,
    name: 'general-log',
    type: 'build_log'
  }).select().single();
  
  if (chanErr) throw chanErr;
  return newChan;
}

async function submitFeedPost() {
  const text = $('create-post-input').value.trim();
  const file = $('post-img-upload').files[0];
  if (!text && !file) {
    toast('Please enter some text or add an image.');
    return;
  }
  
  const submitBtn = $('btn-submit-post');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Posting...';
  
  try {
    const target = await getOrCreatePostTarget();
    let mediaUrl = null;
    
    if (file) {
      const ext = file.name.split('.').pop();
      const path = `${me.id}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await sb.storage.from(BUCKET).upload(path, file);
      if (uploadErr) throw uploadErr;
      
      const { data: { publicUrl } } = sb.storage.from(BUCKET).getPublicUrl(path);
      mediaUrl = publicUrl;
    }
    
    const { error: insertErr } = await sb.from('build_posts').insert({
      channel_id: target.id,
      phantom_id: target.phantom_id,
      user_id: me.id,
      text_content: text,
      media_url: mediaUrl,
      media_type: file ? 'image' : 'text',
      expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString()
    });
    
    if (insertErr) throw insertErr;
    
    $('create-post-input').value = '';
    $('post-img-upload').value = '';
    $('post-img-filename').textContent = '';
    toast('Post shared! 🎉');
    loadFeedPosts();
  } catch (err) {
    toast('Error sharing post: ' + err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Post';
  }
}

// ═══════════════════════════════════════════════════════════
//  PHANTOM v5 EXTENDED FEATURES
// ═══════════════════════════════════════════════════════════

// ── USER METADATA CACHE ──
const userCache = {};

async function getUserMeta(userId) {
  if (userCache[userId]) return userCache[userId];
  const { data: u } = await sb.from('users').select('role, is_verified, is_banned, badge, theme_color').eq('id', userId).single();
  if (u) {
    userCache[userId] = u;
    return u;
  }
  return { role: 'user', is_verified: false, is_banned: false, badge: 'none', theme_color: 'default' };
}

// ── STARRED MESSAGES ──
async function doStarMsg() {
  hideCtx();
  if (!contextTarget) return;
  const msgId = contextTarget.msgId;
  const { data: msg } = await sb.from('messages').select('starred_by').eq('id', msgId).single();
  if (!msg) return;

  let starred = msg.starred_by || [];
  if (starred.includes(me.id)) {
    starred = starred.filter(id => id !== me.id);
    toast('Message unstarred');
  } else {
    starred.push(me.id);
    toast('Message starred! ⭐');
  }
  await sb.from('messages').update({ starred_by: starred }).eq('id', msgId);
  loadMessages(currentChat.convId);
}

async function loadStarredMessages(convId, parentEl) {
  parentEl.appendChild(mk('div', 'info-sec-title', '⭐ Starred Messages'));
  const starredList = mk('div', 'starred-messages-list');
  parentEl.appendChild(starredList);

  const { data: msgs } = await sb.from('messages')
    .select('*')
    .eq('conversation_id', convId)
    .contains('starred_by', [me.id])
    .order('created_at', { ascending: false });

  starredList.innerHTML = '';
  if (!msgs?.length) {
    starredList.innerHTML = '<div style="font-size:.75rem;color:var(--text3);padding:.2rem 0;">No starred messages</div>';
    return;
  }
  msgs.forEach(m => {
    const item = mk('div', 'starred-msg-item');
    item.innerHTML = `
      <div class="starred-msg-hdr">
        <span>${esc(m.sender_name || 'User')}</span>
        <span>${fmtTime(m.created_at)}</span>
      </div>
      <div class="starred-msg-body">${esc(m.text || '[Attachment]')}</div>
    `;
    starredList.appendChild(item);
  });
}

// ── THREADS DRAWER ──
let currentThreadRootId = null;
let threadSub = null;

async function doOpenThread() {
  hideCtx();
  if (!contextTarget) return;
  const msgId = contextTarget.msgId;
  currentThreadRootId = msgId;

  $('info-panel').style.display = 'none';
  $('thread-drawer').style.display = 'flex';

  const { data: msg } = await sb.from('messages').select('*').eq('id', msgId).single();
  if (!msg) return;

  const rootEl = $('thread-root-msg');
  rootEl.innerHTML = '';
  
  // Render root message in thread
  const bubble = buildBubble(msg);
  const cloned = bubble.cloneNode(true);
  rootEl.appendChild(cloned);

  await loadThreadReplies();
  subscribeThreadReplies();
}

async function loadThreadReplies() {
  if (!currentThreadRootId) return;
  const { data: replies } = await sb.from('messages')
    .select('*')
    .eq('thread_parent_id', currentThreadRootId)
    .order('created_at', { ascending: true });

  const listEl = $('thread-replies-list');
  listEl.innerHTML = '';
  if (!replies?.length) {
    listEl.innerHTML = '<div style="font-size:.78rem;color:var(--text3);text-align:center;padding:1rem;">No replies yet. Start the thread!</div>';
    return;
  }
  replies.forEach(r => {
    const row = mk('div', `thread-reply-item ${r.sender_id === me.id ? 'me' : 'them'}`);
    const av = mk('div', 'avatar');
    renderAv(av, r.sender_avatar || '?');
    av.style.cssText = 'width:24px;height:24px;font-size:.65rem;flex-shrink:0;';
    
    const wrap = mk('div', 'msg-wrap');
    const name = mk('div', 'msg-name', esc(r.sender_name || '?'));
    name.style.fontSize = '.7rem';
    wrap.appendChild(name);
    
    const bubble = mk('div', 'bubble');
    bubble.style.padding = '.5rem .7rem';
    bubble.style.fontSize = '.8rem';
    
    const s = mk('span');
    s.innerHTML = formatMentions(r.text);
    bubble.appendChild(s);
    
    const meta = mk('div', 'msg-meta');
    meta.appendChild(mk('span', 'msg-time', fmtTime(r.created_at)));
    
    wrap.appendChild(bubble);
    wrap.appendChild(meta);
    row.append(av, wrap);
    listEl.appendChild(row);
  });
  listEl.scrollTop = listEl.scrollHeight;
}

function subscribeThreadReplies() {
  if (threadSub) threadSub.unsubscribe();
  threadSub = sb.channel('thread-replies-' + currentThreadRootId)
    .on('postgres_changes', { 
      event: 'INSERT', 
      schema: 'public', 
      table: 'messages', 
      filter: `thread_parent_id=eq.${currentThreadRootId}` 
    }, async () => {
      await loadThreadReplies();
    })
    .subscribe();
}

async function sendThreadReply() {
  const input = $('thread-reply-input');
  const text = input.value.trim();
  if (!text || !currentThreadRootId) return;

  input.value = '';
  const { error } = await sb.from('messages').insert({
    conversation_id: currentChat.convId,
    sender_id: me.id,
    sender_name: myData.name || 'User',
    sender_avatar: myData.avatar || '😀',
    text: text,
    thread_parent_id: currentThreadRootId,
    read_by: [me.id],
    delivered_to: [me.id]
  });

  if (error) {
    toast('Failed to send reply: ' + error.message);
  } else {
    await loadThreadReplies();
  }
}

// ── MENTIONS AUTOCOMPLETE ──
let mentionActive = false;
let mentionIndex = 0;
let mentionQuery = '';
let mentionStartIndex = -1;
let currentChatMembers = [];

function setupMentions() {
  const inp = $('msg-input');
  const box = $('mention-autocomplete');
  if (!inp || !box) return;

  inp.addEventListener('input', async () => {
    const val = inp.value;
    const pos = inp.selectionStart;
    const textBeforeCursor = val.substring(0, pos);
    const lastAtIdx = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIdx !== -1 && (lastAtIdx === 0 || /\s/.test(textBeforeCursor[lastAtIdx - 1]))) {
      const query = textBeforeCursor.substring(lastAtIdx + 1);
      if (!/\s/.test(query)) {
        mentionActive = true;
        mentionStartIndex = lastAtIdx;
        mentionQuery = query;
        await showMentionSuggestions(query);
        return;
      }
    }
    closeMentions();
  });

  inp.addEventListener('keydown', (e) => {
    if (!mentionActive) return;
    const items = box.querySelectorAll('.mention-item');
    if (!items.length) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      items[mentionIndex].classList.remove('active');
      mentionIndex = (mentionIndex + 1) % items.length;
      items[mentionIndex].classList.add('active');
      items[mentionIndex].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      items[mentionIndex].classList.remove('active');
      mentionIndex = (mentionIndex - 1 + items.length) % items.length;
      items[mentionIndex].classList.add('active');
      items[mentionIndex].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      selectMention(items[mentionIndex].dataset.username);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeMentions();
    }
  });
}

async function showMentionSuggestions(q) {
  const box = $('mention-autocomplete');
  box.innerHTML = '';
  mentionIndex = 0;

  if (!currentChatMembers.length && currentChat) {
    if (currentChat.type === 'dm') {
      const { data: u } = await sb.from('users').select('*').eq('id', currentChat.otherId).single();
      currentChatMembers = u ? [u] : [];
    } else {
      const { data: members } = await sb.from('conversation_members')
        .select('users(*)')
        .eq('conversation_id', currentChat.convId);
      currentChatMembers = (members || []).map(m => m.users).filter(Boolean);
    }
  }

  const filtered = currentChatMembers.filter(u => 
    (u.name || '').toLowerCase().includes(q.toLowerCase()) || 
    (u.username || '').toLowerCase().includes(q.toLowerCase())
  );

  if (!filtered.length) {
    box.style.display = 'none';
    return;
  }

  filtered.forEach((u, idx) => {
    const item = mk('div', `mention-item${idx === 0 ? ' active' : ''}`);
    item.dataset.username = u.username || u.name;
    const av = mk('div', 'avatar');
    renderAv(av, u.avatar || '?');
    av.style.cssText = 'width:20px;height:20px;font-size:.6rem;flex-shrink:0;';
    
    const info = mk('div');
    info.style.cssText = 'flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
    info.innerHTML = `<b>${esc(u.name || '')}</b> <span style="font-size:.7rem;color:var(--text3);">@${esc(u.username || '')}</span>`;
    
    item.append(av, info);
    item.onclick = () => selectMention(u.username || u.name);
    box.appendChild(item);
  });
  box.style.display = 'flex';
}

function selectMention(username) {
  const inp = $('msg-input');
  const val = inp.value;
  const pos = inp.selectionEnd;
  const before = val.substring(0, mentionStartIndex);
  const after = val.substring(pos);
  inp.value = before + '@' + username + ' ' + after;
  inp.focus();
  const newPos = mentionStartIndex + username.length + 2;
  inp.selectionStart = inp.selectionEnd = newPos;
  closeMentions();
  autoResize(inp);
}

function closeMentions() {
  mentionActive = false;
  const box = $('mention-autocomplete');
  if (box) {
    box.style.display = 'none';
    box.innerHTML = '';
  }
}

function formatMentions(text) {
  if (!text) return '';
  return esc(text).replace(/@([a-zA-Z0-9_]{3,20})/g, (match, username) => {
    return `<span class="mention-badge" style="cursor:pointer;" onclick="openProfileByUsername('${username}')">@${username}</span>`;
  });
}

async function openProfileByUsername(username) {
  const { data: u } = await sb.from('users').select('*').eq('username', username.toLowerCase()).maybeSingle();
  if (u) openDM(u);
  else toast('User not found');
}

// ── ANNOUNCEMENTS BANNER ──
function setupAnnouncements() {
  sb.channel('announcements')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async p => {
      if (p.new.conversation_id === '00000000-0000-0000-0000-000000000000') {
        showGlobalAnnouncement(p.new.text);
      }
    })
    .subscribe();
  
  if ($('btn-close-announcement')) {
    $('btn-close-announcement').onclick = () => {
      $('global-announcement-banner').style.display = 'none';
    };
  }
}

function showGlobalAnnouncement(text) {
  const banner = $('global-announcement-banner');
  const textEl = $('global-announcement-text');
  if (banner && textEl) {
    textEl.textContent = text;
    banner.style.display = 'flex';
  }
}

// ── ADMIN DASHBOARD ──
let adminUsers = [];

function setupAdminDashboard() {
  const btnAdmin = $('nav-btn-admin');
  const btnDashboard = $('btn-admin-dashboard');
  
  const showAdmin = async () => {
    closeChat();
    $('home-feed').style.display = 'none';
    $('chat-placeholder').style.display = 'none';
    $('active-chat').style.display = 'none';
    $('admin-panel-view').style.display = 'flex';
    
    document.querySelectorAll('.nav-item').forEach(b => {
      b.classList.toggle('active', b.id === 'nav-btn-admin');
    });
    
    closeModal('profile-modal');
    await loadAdminStats();
    await loadAdminUsers();
    await loadAdminReports();
    await loadAdminAuditLogs();
  };

  if (btnAdmin) btnAdmin.onclick = showAdmin;
  if (btnDashboard) btnDashboard.onclick = showAdmin;
  
  if ($('btn-close-admin')) {
    $('btn-close-admin').onclick = () => {
      $('admin-panel-view').style.display = 'none';
      switchFeedOrChat('feed');
    };
  }

  if ($('btn-admin-announce')) $('btn-admin-announce').onclick = broadcastAnnouncement;
  if ($('admin-user-search')) {
    let usd;
    $('admin-user-search').oninput = (e) => {
      clearTimeout(usd);
      usd = setTimeout(() => filterAdminUsers(e.target.value.trim()), 300);
    };
  }
}

async function loadAdminStats() {
  const { count: usersCount } = await sb.from('users').select('*', { count: 'exact', head: true });
  $('admin-stat-users').textContent = usersCount || 0;

  const { count: activeCount } = await sb.from('users').select('*', { count: 'exact', head: true }).eq('online', true);
  $('admin-stat-active').textContent = activeCount || 0;

  const { count: reportsCount } = await sb.from('reports').select('*', { count: 'exact', head: true });
  $('admin-stat-reports').textContent = reportsCount || 0;

  const { count: messagesCount } = await sb.from('messages').select('*', { count: 'exact', head: true });
  $('admin-stat-messages').textContent = messagesCount || 0;
}

async function loadAdminUsers() {
  const { data } = await sb.from('users').select('*').order('name');
  adminUsers = data || [];
  renderAdminUsers(adminUsers);
}

function renderAdminUsers(users) {
  const list = $('admin-users-list');
  list.innerHTML = '';
  
  users.forEach(u => {
    const tr = mk('tr');
    
    const tdUser = mk('td');
    tdUser.style.display = 'flex';
    tdUser.style.alignItems = 'center';
    tdUser.style.gap = '0.5rem';
    const av = mk('div', 'avatar');
    renderAv(av, u.avatar || '?');
    av.style.cssText = 'width:24px;height:24px;font-size:.65rem;';
    const info = mk('div');
    info.innerHTML = `<b>${esc(u.name || '')}</b><br><span style="font-size:.7rem;color:var(--text3);">@${esc(u.username || '')}</span>`;
    tdUser.append(av, info);
    
    const tdRole = mk('td');
    tdRole.innerHTML = `<span class="badge-role ${u.role || 'user'}">${u.role || 'user'}</span>`;
    
    const tdStatus = mk('td');
    if (u.is_banned) {
      tdStatus.innerHTML = '<span style="color:var(--danger);font-weight:600;">Suspended</span>';
    } else {
      tdStatus.innerHTML = u.online ? '<span style="color:var(--online);font-weight:600;">Online</span>' : '<span style="color:var(--text3);">Offline</span>';
    }
    
    const tdActions = mk('td');
    tdActions.style.display = 'flex';
    tdActions.style.gap = '0.4rem';
    
    if (!u.is_verified) {
      const btnVerify = mk('button', 'admin-btn admin-btn-verify', 'Verify');
      btnVerify.onclick = async () => {
        await sb.from('users').update({ is_verified: true }).eq('id', u.id);
        await writeAuditLog('Verify User', u.name);
        toast('User verified ✓');
        await loadAdminUsers();
        await loadAdminAuditLogs();
      };
      tdActions.appendChild(btnVerify);
    }
    
    if (u.is_banned) {
      const btnUnban = mk('button', 'admin-btn admin-btn-unban', 'Unban');
      btnUnban.onclick = async () => {
        await sb.from('users').update({ is_banned: false }).eq('id', u.id);
        await writeAuditLog('Unsuspend User', u.name);
        toast('User unsuspended');
        await loadAdminUsers();
        await loadAdminAuditLogs();
      };
      tdActions.appendChild(btnUnban);
    } else {
      const btnBan = mk('button', 'admin-btn admin-btn-ban', 'Suspend');
      btnBan.onclick = async () => {
        if (u.role === 'owner') { toast('Cannot suspend owner'); return; }
        await sb.from('users').update({ is_banned: true }).eq('id', u.id);
        await writeAuditLog('Suspend User', u.name);
        toast('User suspended');
        await loadAdminUsers();
        await loadAdminAuditLogs();
      };
      tdActions.appendChild(btnBan);
    }
    
    const btnDel = mk('button', 'admin-btn admin-btn-delete', 'Delete');
    btnDel.onclick = async () => {
      if (u.role === 'owner') { toast('Cannot delete owner'); return; }
      if (confirm(`Are you sure you want to permanently delete user ${u.name}?`)) {
        await sb.from('users').delete().eq('id', u.id);
        await writeAuditLog('Delete User', u.name);
        toast('User deleted');
        await loadAdminUsers();
        await loadAdminAuditLogs();
      }
    };
    tdActions.appendChild(btnDel);

    tr.append(tdUser, tdRole, tdStatus, tdActions);
    list.appendChild(tr);
  });
}

function filterAdminUsers(q) {
  if (!q) {
    renderAdminUsers(adminUsers);
    return;
  }
  const filtered = adminUsers.filter(u => 
    (u.name || '').toLowerCase().includes(q.toLowerCase()) || 
    (u.username || '').toLowerCase().includes(q.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(q.toLowerCase())
  );
  renderAdminUsers(filtered);
}

async function loadAdminReports() {
  const { data } = await sb.from('reports').select('*, reporter:users!reports_reporter_id_fkey(*), reported:users!reports_reported_id_fkey(*)');
  const list = $('admin-reports-list');
  list.innerHTML = '';

  if (!data?.length) {
    list.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text3);">No reports submitted.</td></tr>';
    return;
  }

  data.forEach(r => {
    const tr = mk('tr');
    tr.innerHTML = `
      <td><b>${esc(r.reporter?.name || 'User')}</b><br><span style="font-size:.7rem;color:var(--text3);">@${esc(r.reporter?.username || '')}</span></td>
      <td><b>${esc(r.reported?.name || 'User')}</b><br><span style="font-size:.7rem;color:var(--text3);">@${esc(r.reported?.username || '')}</span></td>
      <td>${esc(r.reason || 'No reason specified')}</td>
    `;
    
    const tdAct = mk('td');
    tdAct.style.display = 'flex';
    tdAct.style.gap = '0.4rem';
    
    const btnDismiss = mk('button', 'admin-btn admin-btn-verify', 'Dismiss');
    btnDismiss.onclick = async () => {
      await sb.from('reports').delete().eq('id', r.id);
      await writeAuditLog('Dismiss Report', r.reported?.name || 'User');
      toast('Report dismissed');
      await loadAdminReports();
      await loadAdminAuditLogs();
    };
    tdAct.appendChild(btnDismiss);
    
    if (r.reported && !r.reported.is_banned) {
      const btnBan = mk('button', 'admin-btn admin-btn-ban', 'Suspend');
      btnBan.onclick = async () => {
        await sb.from('users').update({ is_banned: true }).eq('id', r.reported_id);
        await sb.from('reports').delete().eq('id', r.id);
        await writeAuditLog('Suspend User (Reported)', r.reported?.name || 'User');
        toast('Offender suspended and report resolved');
        await loadAdminReports();
        await loadAdminAuditLogs();
      };
      tdAct.appendChild(btnBan);
    }
    
    tr.appendChild(tdAct);
    list.appendChild(tr);
  });
}

async function broadcastAnnouncement() {
  const input = $('admin-announce-in');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';

  const { error } = await sb.from('messages').insert({
    conversation_id: '00000000-0000-0000-0000-000000000000',
    sender_id: me.id,
    sender_name: 'SYSTEM ANNOUNCEMENT',
    sender_avatar: '📢',
    text: text
  });

  if (error) {
    toast('Announcement failed: ' + error.message);
  } else {
    await writeAuditLog('Broadcast Announcement', text);
    toast('Announcement broadcasted! 📢');
    await loadAdminAuditLogs();
  }
}

// ── DISCOVERABILITY ROOM SEARCH & HASHTAGS ──
let allRoomsCache = [];

function setupHashtagsSearch() {
  const roomIn = $('room-search');
  if (!roomIn) return;
  
  let rsd;
  roomIn.oninput = (e) => {
    clearTimeout(rsd);
    rsd = setTimeout(() => filterRoomsList(e.target.value.trim()), 300);
  };
}

function filterRoomsList(q) {
  const list = $('rooms-inner');
  if (!q) {
    loadRooms();
    return;
  }
  
  list.innerHTML = '';
  const filtered = allRoomsCache.filter(r => 
    (r.name || '').toLowerCase().includes(q.toLowerCase()) ||
    (r.description || '').toLowerCase().includes(q.toLowerCase()) ||
    (r.tags || '').toLowerCase().includes(q.toLowerCase())
  );
  
  if (!filtered.length) {
    list.innerHTML = '<div class="list-empty">No matching rooms found.</div>';
    return;
  }
  
  filtered.forEach(r => {
    const preview = r.tags ? r.tags + ' · ' + (r.description||'') : r.description||'';
    const item = buildChatItem({avatar:'🏠', name:r.name, preview, time:'', unread:0});
    item.addEventListener('click',()=>openConv(r));
    if (currentChat?.convId===r.id) item.classList.add('active');
    list.appendChild(item);
  });
}

// ── CUSTOM ACCENT THEMES APP LIER ──
function applyTheme(themeColor) {
  document.body.className = document.body.className.replace(/\btheme-\S+/g, '');
  if (themeColor && themeColor !== 'default') {
    document.body.classList.add('theme-' + themeColor);
  }
}

// ── SYSTEM AUDIT LOGGING WRITER ──
async function writeAuditLog(action, targetName) {
  try {
    await sb.from('audit_logs').insert({
      actor_id: me.id,
      actor_name: myData.name || 'Admin',
      action: action,
      target_name: targetName
    });
  } catch (err) {
    console.error('Audit logging failed', err);
  }
}

async function loadAdminAuditLogs() {
  const { data } = await sb.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(20);
  const list = $('admin-audit-list');
  if (!list) return;
  list.innerHTML = '';
  if (!data?.length) {
    list.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text3);">No audit logs yet.</td></tr>';
    return;
  }
  data.forEach(log => {
    const tr = mk('tr');
    tr.innerHTML = `
      <td><b>${esc(log.actor_name || 'System')}</b></td>
      <td><span class="badge-role" style="background:var(--acc-dim);color:var(--acc);padding:0.2rem 0.5rem;border-radius:6px;font-size:0.75rem;font-weight:600;">${esc(log.action)}</span></td>
      <td>${esc(log.target_name || 'N/A')}</td>
      <td><span style="font-size:.75rem;color:var(--text3);">${fmtTime(log.created_at)}</span></td>
    `;
    list.appendChild(tr);
  });
}

// ── PROFANITY & SPAM FILTER MODERATION ──
function checkProfanityFilter(text) {
  const filterEnabled = $('toggle-profanity-filter') ? $('toggle-profanity-filter').checked : true;
  if (!filterEnabled) return false;

  const rawList = $('admin-profanity-words') ? $('admin-profanity-words').value : 'spam, scam, hack, exploit, freebie';
  const badWords = rawList.split(',').map(w => w.trim().toLowerCase()).filter(Boolean);

  const cleanText = text.toLowerCase();
  for (const word of badWords) {
    if (cleanText.includes(word)) {
      return true;
    }
  }
  return false;
}