import { auth, googleProvider, signInWithPopup, signOut, onAuthStateChanged, db, ref, onValue, set } from "./firebase-config.js";

let tracks = [];
let currentTrackIndex = -1;
let likedTrackIds = new Set();
let customPlaylists = [];
let currentUser = null;
let selectedCategory = "";
let currentDetailPlaylistId = null;

const audioPlayer = new Audio();

document.addEventListener("DOMContentLoaded", async () => {
  await loadMusicData();
  setupNavigation();
  setupSearchAndFilters();
  setupPlayerControls();
  setupAuth();
  setupModals();
});

async function loadMusicData() {
  try {
    const res = await fetch("music.json");
    tracks = await res.json();
    renderPopularTracks();
    renderLibraryGrid();
    if (tracks.length > 0) {
      document.getElementById("hero-video").src = tracks[0].mediaUrl;
    }
  } catch (e) {
    console.error("Erreur music.json", e);
  }
}

function setupNavigation() {
  document.querySelectorAll(".nav-item").forEach(item => {
    item.addEventListener("click", () => {
      document.querySelectorAll(".nav-item").forEach(i => i.classList.remove("active"));
      document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
      
      item.classList.add("active");
      const targetTab = item.getAttribute("data-tab");
      document.getElementById(targetTab).classList.add("active");

      if (targetTab === "tab-library") {
        renderLibraryGrid();
      }
    });
  });

  document.getElementById("back-to-library-btn").addEventListener("click", () => {
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    document.getElementById("tab-library").classList.add("active");
  });

  document.getElementById("delete-playlist-btn").addEventListener("click", () => {
    if (currentDetailPlaylistId) {
      deleteCustomPlaylist(currentDetailPlaylistId);
    }
  });

  document.getElementById("bottom-player").addEventListener("click", () => {
    if (currentTrackIndex !== -1) {
      document.getElementById("full-player-modal").classList.add("active");
    }
  });

  document.getElementById("close-full-player").addEventListener("click", (e) => {
    e.stopPropagation();
    document.getElementById("full-player-modal").classList.remove("active");
  });
}

function setupSearchAndFilters() {
  const searchInput = document.getElementById("search-input");
  
  const filterAndRender = () => {
    const query = searchInput.value.toLowerCase().trim();
    const filtered = tracks.filter(t => {
      const matchesQuery = !query || t.title.toLowerCase().includes(query) || t.artist.toLowerCase().includes(query) || t.album.toLowerCase().includes(query);
      const matchesCategory = !selectedCategory || (t.categories && t.categories.includes(selectedCategory));
      return matchesQuery && matchesCategory;
    });

    const list = document.getElementById("search-results-list");
    list.innerHTML = "";
    filtered.forEach((track) => {
      const index = tracks.findIndex(t => t.id === track.id);
      list.appendChild(createTrackItemElement(track, index));
    });
  };

  searchInput.addEventListener("input", filterAndRender);

  document.querySelectorAll(".chip").forEach(chip => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      selectedCategory = chip.getAttribute("data-category");
      filterAndRender();
    });
  });
}

function renderPopularTracks() {
  const list = document.getElementById("popular-tracks-list");
  list.innerHTML = "";
  tracks.forEach((track, index) => {
    list.appendChild(createTrackItemElement(track, index));
  });
}

function renderLibraryGrid() {
  const grid = document.getElementById("library-playlists-grid");
  grid.innerHTML = "";

  // 1. Titres Aimés
  const likedCard = document.createElement("div");
  likedCard.className = "track-item";
  likedCard.innerHTML = `
    <div class="track-info-left">
      <div style="width: 50px; height: 50px; border-radius: 10px; background: var(--primary); display: flex; align-items: center; justify-content: center;">
        <svg style="width:26px; height:26px; fill:white;" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
      </div>
      <div>
        <div style="font-size: 16px; font-weight: bold;">Titres aimés</div>
        <div style="color: var(--text-muted); font-size: 13px;">Ma musique • ${likedTrackIds.size} titre${likedTrackIds.size > 1 ? 's' : ''}</div>
      </div>
    </div>
  `;
  likedCard.addEventListener("click", () => openPlaylistDetail("liked_songs", "Titres aimés", "Vos morceaux préférés", tracks.filter(t => likedTrackIds.has(t.id))));
  grid.appendChild(likedCard);

  // 2. The Wawnerie
  const wawnerieCard = document.createElement("div");
  wawnerieCard.className = "track-item";
  wawnerieCard.innerHTML = `
    <div class="track-info-left">
      <img src="logo.png" style="width: 50px; height: 50px; border-radius: 10px; object-fit: cover;" onerror="this.style.display='none'">
      <div>
        <div style="font-size: 16px; font-weight: bold;">The Wawnerie</div>
        <div style="color: var(--text-muted); font-size: 13px;">Playlist Officielle • ${tracks.length} titres</div>
      </div>
    </div>
  `;
  wawnerieCard.addEventListener("click", () => openPlaylistDetail("wawnerie_official", "The Wawnerie", "La sélection officielle SpotiWawn.", tracks));
  grid.appendChild(wawnerieCard);

  // 3. Custom Playlists
  customPlaylists.forEach(pl => {
    const plCard = document.createElement("div");
    plCard.className = "track-item";
    const plTracks = tracks.filter(t => pl.trackIds && pl.trackIds.includes(t.id));
    plCard.innerHTML = `
      <div class="track-info-left">
        <div style="width: 50px; height: 50px; border-radius: 10px; background: ${pl.coverColorHex || '#FF5500'}; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 20px;">🎵</div>
        <div>
          <div style="font-size: 16px; font-weight: bold;">${pl.title}</div>
          <div style="color: var(--text-muted); font-size: 13px;">Playlist créée • ${plTracks.length} titre${plTracks.length > 1 ? 's' : ''}</div>
        </div>
      </div>
    `;
    plCard.addEventListener("click", () => openPlaylistDetail(pl.id, pl.title, "Playlist personnalisée SpotiWawn", plTracks, true));
    grid.appendChild(plCard);
  });
}

function openPlaylistDetail(id, title, desc, playlistTracks, isCustom = false) {
  currentDetailPlaylistId = id;
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById("tab-playlist-detail").classList.add("active");

  document.getElementById("detail-playlist-title").innerText = title;
  document.getElementById("detail-playlist-desc").innerText = desc;
  document.getElementById("delete-playlist-btn").style.display = isCustom ? "block" : "none";

  const list = document.getElementById("detail-tracks-list");
  list.innerHTML = "";
  playlistTracks.forEach((track) => {
    const index = tracks.findIndex(t => t.id === track.id);
    list.appendChild(createTrackItemElement(track, index));
  });

  document.getElementById("detail-play-btn").onclick = () => {
    if (playlistTracks.length > 0) {
      const idx = tracks.findIndex(t => t.id === playlistTracks[0].id);
      playTrack(idx);
    }
  };
}

function createTrackItemElement(track, index) {
  const isLiked = likedTrackIds.has(track.id);
  const div = document.createElement("div");
  div.className = "track-item";
  div.innerHTML = `
    <div class="track-info-left">
      <span style="color: var(--text-muted); font-weight: bold; width: 20px;">${index + 1}</span>
      <div>
        <div style="font-weight: bold; font-size: 15px;">${track.title}</div>
        <div style="color: var(--text-muted); font-size: 13px;">${track.artist}</div>
      </div>
    </div>
    <button class="btn-icon like-btn ${isLiked ? 'active' : ''}" data-id="${track.id}">
      <svg style="width:22px; height:22px; fill:${isLiked ? 'var(--primary)' : 'var(--text-muted)'};" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
    </button>
  `;

  div.addEventListener("click", (e) => {
    if (!e.target.closest(".like-btn")) {
      playTrack(index);
    }
  });

  div.querySelector(".like-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    toggleFavorite(track.id);
  });

  return div;
}

function playTrack(index) {
  if (index < 0 || index >= tracks.length) return;
  currentTrackIndex = index;
  const track = tracks[index];

  audioPlayer.src = track.mediaUrl;
  audioPlayer.play();

  document.getElementById("player-title").innerText = track.title;
  document.getElementById("player-artist").innerText = track.artist;
  document.getElementById("mini-video").src = track.mediaUrl;
  document.getElementById("mini-video").style.display = "block";

  document.getElementById("full-title").innerText = track.title;
  document.getElementById("full-artist").innerText = track.artist;
  document.getElementById("full-video").src = track.mediaUrl;

  updatePlayPauseUI(true);
}

function toggleFavorite(trackId) {
  if (likedTrackIds.has(trackId)) {
    likedTrackIds.delete(trackId);
  } else {
    likedTrackIds.add(trackId);
  }
  
  renderPopularTracks();

  if (currentUser) {
    set(ref(db, `users/${currentUser.uid}/likedTrackIds`), Array.from(likedTrackIds));
  }
}

function createCustomPlaylist(title) {
  if (!title.trim()) return;
  const newPl = {
    id: "user_playlist_" + Date.now(),
    title: title.trim(),
    subtitle: "Playlist créée",
    description: "Playlist personnalisée SpotiWawn",
    coverColorHex: "#FF5500",
    coverSymbol: "🎵",
    trackIds: []
  };
  customPlaylists.push(newPl);
  renderLibraryGrid();

  if (currentUser) {
    set(ref(db, `users/${currentUser.uid}/playlists`), customPlaylists);
  }
}

function deleteCustomPlaylist(playlistId) {
  customPlaylists = customPlaylists.filter(pl => pl.id !== playlistId);
  renderLibraryGrid();
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById("tab-library").classList.add("active");

  if (currentUser) {
    set(ref(db, `users/${currentUser.uid}/playlists`), customPlaylists);
  }
}

function setupPlayerControls() {
  const playBtn = document.getElementById("play-pause-btn");
  const heroPlayBtn = document.getElementById("hero-play-btn");

  const togglePlay = () => {
    if (currentTrackIndex === -1 && tracks.length > 0) {
      playTrack(0);
      return;
    }
    if (audioPlayer.paused) {
      audioPlayer.play();
      updatePlayPauseUI(true);
    } else {
      audioPlayer.pause();
      updatePlayPauseUI(false);
    }
  };

  playBtn.addEventListener("click", (e) => { e.stopPropagation(); togglePlay(); });
  heroPlayBtn.addEventListener("click", togglePlay);

  document.getElementById("prev-btn").addEventListener("click", (e) => { e.stopPropagation(); playTrack(currentTrackIndex - 1); });
  document.getElementById("next-btn").addEventListener("click", (e) => { e.stopPropagation(); playTrack(currentTrackIndex + 1); });

  audioPlayer.addEventListener("timeupdate", () => {
    if (audioPlayer.duration) {
      const pct = (audioPlayer.currentTime / audioPlayer.duration) * 100;
      document.getElementById("seek-bar").value = pct;
      document.getElementById("current-time").innerText = formatTime(audioPlayer.currentTime);
      document.getElementById("total-time").innerText = formatTime(audioPlayer.duration);
    }
  });

  document.getElementById("seek-bar").addEventListener("input", (e) => {
    if (audioPlayer.duration) {
      audioPlayer.currentTime = (e.target.value / 100) * audioPlayer.duration;
    }
  });
}

function updatePlayPauseUI(isPlaying) {
  const icon = document.getElementById("play-icon");
  if (isPlaying) {
    icon.setAttribute("d", "M6 19h4V5H6v14zm8-14v14h4V5h-4z");
  } else {
    icon.setAttribute("d", "M8 5v14l11-7z");
  }
}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function setupModals() {
  const createModal = document.getElementById("create-playlist-modal");
  document.getElementById("open-create-playlist-btn").addEventListener("click", () => createModal.classList.add("active"));
  document.getElementById("cancel-create-playlist-btn").addEventListener("click", () => createModal.classList.remove("active"));
  document.getElementById("confirm-create-playlist-btn").addEventListener("click", () => {
    const title = document.getElementById("new-playlist-title").value;
    createCustomPlaylist(title);
    document.getElementById("new-playlist-title").value = "";
    createModal.classList.remove("active");
  });
}

function setupAuth() {
  const authBtn = document.getElementById("auth-btn");
  const welcomeModal = document.getElementById("welcome-modal");

  authBtn.addEventListener("click", () => {
    if (currentUser) {
      signOut(auth);
    } else {
      signInWithPopup(auth, googleProvider);
    }
  });

  document.getElementById("welcome-signin-btn").addEventListener("click", () => {
    welcomeModal.classList.remove("active");
    signInWithPopup(auth, googleProvider);
  });

  document.getElementById("welcome-guest-btn").addEventListener("click", () => {
    welcomeModal.classList.remove("active");
  });

  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (user) {
      welcomeModal.classList.remove("active");

      document.getElementById("user-name").innerText = user.displayName;
      document.getElementById("user-email").innerText = user.email;
      document.getElementById("user-avatar").src = user.photoURL;
      document.getElementById("user-avatar").style.display = "block";
      authBtn.innerText = "Se déconnecter";

      // Nav bar avatar
      document.getElementById("nav-default-avatar").style.display = "none";
      const navAvatar = document.getElementById("nav-user-avatar");
      navAvatar.src = user.photoURL;
      navAvatar.style.display = "block";

      onValue(ref(db, `users/${user.uid}`), (snapshot) => {
        const data = snapshot.val();
        if (data) {
          if (data.likedTrackIds) {
            likedTrackIds = new Set(data.likedTrackIds);
          }
          if (data.playlists) {
            customPlaylists = data.playlists;
          }
          renderPopularTracks();
          renderLibraryGrid();
        }
      });
    } else {
      welcomeModal.classList.add("active");

      document.getElementById("user-name").innerText = "Invité SpotiWawn";
      document.getElementById("user-email").innerText = "non_connecte@spotiwawn.app";
      document.getElementById("user-avatar").style.display = "none";
      authBtn.innerText = "Se connecter avec Google";

      document.getElementById("nav-user-avatar").style.display = "none";
      document.getElementById("nav-default-avatar").style.display = "block";
    }
  });
}
