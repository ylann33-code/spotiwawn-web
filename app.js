import { auth, googleProvider, signInWithPopup, signOut, onAuthStateChanged, db, ref, onValue, set } from "./firebase-config.js";

let tracks = [];
let currentTrackIndex = -1;
let likedTrackIds = new Set();
let customPlaylists = [];
let currentUser = null;

const audioPlayer = new Audio();

// Init
document.addEventListener("DOMContentLoaded", async () => {
  await loadMusicData();
  setupNavigation();
  setupPlayerControls();
  setupAuth();
});

async function loadMusicData() {
  try {
    const res = await fetch("music.json");
    tracks = await res.json();
    renderPopularTracks();
    if (tracks.length > 0) {
      document.getElementById("hero-video").src = tracks[0].mediaUrl;
    }
  } catch (e) {
    console.error("Erreur de chargement de music.json", e);
  }
}

function setupNavigation() {
  document.querySelectorAll(".nav-item").forEach(item => {
    item.addEventListener("click", () => {
      document.querySelectorAll(".nav-item").forEach(i => i.classList.remove("active"));
      document.querySelectorAll(".tab-screen").forEach(s => s.classList.remove("active"));
      
      item.classList.add("active");
      const targetTab = item.getAttribute("data-tab");
      document.getElementById(targetTab).classList.add("active");
    });
  });
}

function renderPopularTracks() {
  const list = document.getElementById("popular-tracks-list");
  list.innerHTML = "";
  tracks.forEach((track, index) => {
    const isLiked = likedTrackIds.has(track.id);
    const div = document.createElement("div");
    div.className = "track-item";
    div.innerHTML = `
      <div class="track-left">
        <span style="color: var(--text-muted); font-weight: bold; width: 20px;">${index + 1}</span>
        <div>
          <div style="font-weight: bold;">${track.title}</div>
          <div style="color: var(--text-muted); font-size: 12px;">${track.artist}</div>
        </div>
      </div>
      <button class="like-btn ${isLiked ? 'liked' : ''}" data-id="${track.id}">${isLiked ? '❤️' : '🤍'}</button>
    `;
    div.addEventListener("click", (e) => {
      if (!e.target.classList.contains("like-btn")) {
        playTrack(index);
      }
    });
    list.appendChild(div);
  });

  document.querySelectorAll(".like-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.getAttribute("data-id");
      toggleFavorite(id);
    });
  });
}

function playTrack(index) {
  if (index < 0 || index >= tracks.length) return;
  currentTrackIndex = index;
  const track = tracks[index];
  
  audioPlayer.src = track.mediaUrl;
  audioPlayer.play();

  document.getElementById("player-title").innerText = track.title;
  document.getElementById("player-artist").innerText = track.artist;
  document.getElementById("play-pause-btn").innerText = "⏸";
  document.getElementById("hero-video").src = track.mediaUrl;
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
      playBtn.innerText = "⏸";
    } else {
      audioPlayer.pause();
      playBtn.innerText = "▶";
    }
  };

  playBtn.addEventListener("click", togglePlay);
  heroPlayBtn.addEventListener("click", togglePlay);

  document.getElementById("prev-btn").addEventListener("click", () => playTrack(currentTrackIndex - 1));
  document.getElementById("next-btn").addEventListener("click", () => playTrack(currentTrackIndex + 1));

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

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function setupAuth() {
  const authBtn = document.getElementById("auth-btn");
  
  authBtn.addEventListener("click", () => {
    if (currentUser) {
      signOut(auth);
    } else {
      signInWithPopup(auth, googleProvider);
    }
  });

  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (user) {
      document.getElementById("user-name").innerText = user.displayName;
      document.getElementById("user-email").innerText = user.email;
      document.getElementById("user-avatar").src = user.photoURL;
      document.getElementById("user-avatar").style.display = "block";
      authBtn.innerText = "Se déconnecter";

      // Realtime Sync from Firebase
      onValue(ref(db, `users/${user.uid}`), (snapshot) => {
        const data = snapshot.val();
        if (data) {
          if (data.likedTrackIds) {
            likedTrackIds = new Set(data.likedTrackIds);
            renderPopularTracks();
          }
        }
      });
    } else {
      document.getElementById("user-name").innerText = "Invité SpotiWawn";
      document.getElementById("user-email").innerText = "non_connecte@spotiwawn.app";
      document.getElementById("user-avatar").style.display = "none";
      authBtn.innerText = "Se connecter avec Google";
    }
  });
}
