(() => {
  const songs = Array.isArray(window.HARMONY_SONGS) ? window.HARMONY_SONGS : [];
  const defaultCover = "assets/covers/default-cover.svg";
  const embeddedCover =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 720 720'%3E%3Crect width='720' height='720' rx='72' fill='%23080908'/%3E%3Crect x='24' y='24' width='672' height='672' rx='56' fill='%231cae88'/%3E%3Ccircle cx='270' cy='310' r='224' fill='%23f6f3ec' opacity='.18'/%3E%3Ccircle cx='474' cy='412' r='196' fill='%23ffffff' opacity='.12'/%3E%3Cpath d='M328 432a37 37 0 1 1-27-35.5V263l132-28v157a37 37 0 1 1-27-35.5v-75.7l-78 16.6V432Z' fill='%23f6f3ec'/%3E%3C/svg%3E";

  const icons = {
    play: "assets/icons/play.svg",
    pause: "assets/icons/pause.svg",
    heart: "assets/icons/heart.svg",
    heartFilled: "assets/icons/heart-filled.svg",
    volume: "assets/icons/volume.svg",
    mute: "assets/icons/mute.svg"
  };

  const storageKeys = {
    currentUser: "harmony:current-user",
    favorites: "harmony:favorites",
    volume: "harmony:volume",
    lastVolume: "harmony:last-volume"
  };

  const currentUser = getCurrentUser();

  if (!currentUser) {
    redirectToLogin();
    return;
  }

  const audio = document.getElementById("audio");
  const els = {
    navItems: document.querySelectorAll(".nav-item"),
    welcomeName: document.getElementById("welcomeName"),
    logoutBtn: document.getElementById("logoutBtn"),
    likedCount: document.getElementById("likedCount"),
    viewEyebrow: document.getElementById("viewEyebrow"),
    viewTitle: document.getElementById("viewTitle"),
    trackContext: document.getElementById("trackContext"),
    tracksHeading: document.getElementById("tracksHeading"),
    resultCount: document.getElementById("resultCount"),
    trackGrid: document.getElementById("trackGrid"),
    emptyState: document.getElementById("emptyState"),
    searchInput: document.getElementById("searchInput"),
    clearSearch: document.getElementById("clearSearch"),
    heroCover: document.getElementById("heroCover"),
    heroTitle: document.getElementById("heroTitle"),
    heroArtist: document.getElementById("heroArtist"),
    heroEyebrow: document.getElementById("heroEyebrow"),
    heroPlay: document.getElementById("heroPlay"),
    heroPlayIcon: document.getElementById("heroPlayIcon"),
    heroPlayText: document.getElementById("heroPlayText"),
    heroFavorite: document.getElementById("heroFavorite"),
    playerCover: document.getElementById("playerCover"),
    playerTitle: document.getElementById("playerTitle"),
    playerArtist: document.getElementById("playerArtist"),
    playerFavorite: document.getElementById("playerFavorite"),
    playPauseBtn: document.getElementById("playPauseBtn"),
    playPauseIcon: document.getElementById("playPauseIcon"),
    prevBtn: document.getElementById("prevBtn"),
    nextBtn: document.getElementById("nextBtn"),
    progressRange: document.getElementById("progressRange"),
    currentTime: document.getElementById("currentTime"),
    durationTime: document.getElementById("durationTime"),
    volumeRange: document.getElementById("volumeRange"),
    muteBtn: document.getElementById("muteBtn"),
    volumeIcon: document.getElementById("volumeIcon")
  };

  const state = {
    currentIndex: 0,
    activeView: "home",
    query: "",
    isPlaying: false,
    requestedPlayback: false,
    favorites: loadFavorites(),
    unavailableIds: new Set()
  };

  let animationFrame = 0;

  function init() {
    syncAccountUi();
    els.logoutBtn.addEventListener("click", logout);

    if (!songs.length) {
      disablePlayer();
      return;
    }

    keepOnlyValidFavorites();
    bindEvents();
    setVolume(readStoredVolume());
    loadSong(0, false);
    renderView();
  }

  function bindEvents() {
    els.trackGrid.addEventListener("click", onTrackGridClick);
    els.trackGrid.addEventListener("keydown", onTrackGridKeydown);
    els.trackGrid.addEventListener("error", onImageError, true);
    els.heroCover.addEventListener("error", onImageError);
    els.playerCover.addEventListener("error", onImageError);

    els.searchInput.addEventListener("input", (event) => {
      state.query = event.target.value.trim().toLowerCase();
      renderSongs();
    });

    els.clearSearch.addEventListener("click", () => {
      state.query = "";
      els.searchInput.value = "";
      renderSongs();
      els.searchInput.focus();
    });

    els.navItems.forEach((item) => {
      item.addEventListener("click", () => {
        state.activeView = item.dataset.view;
        state.query = "";
        els.searchInput.value = "";
        renderView();
      });
    });

    els.playPauseBtn.addEventListener("click", togglePlayback);
    els.heroPlay.addEventListener("click", togglePlayback);
    els.prevBtn.addEventListener("click", playPrevious);
    els.nextBtn.addEventListener("click", playNext);
    els.heroFavorite.addEventListener("click", () => toggleFavorite(currentSong().id));
    els.playerFavorite.addEventListener("click", () => toggleFavorite(currentSong().id));
    els.muteBtn.addEventListener("click", toggleMute);

    els.progressRange.addEventListener("input", previewSeek);
    els.progressRange.addEventListener("change", commitSeek);
    els.volumeRange.addEventListener("input", (event) => setVolume(Number(event.target.value)));

    audio.addEventListener("loadedmetadata", updateProgress);
    audio.addEventListener("timeupdate", updateProgress);
    audio.addEventListener("play", () => {
      state.isPlaying = true;
      state.requestedPlayback = false;
      syncPlaybackUi();
      startProgressLoop();
    });
    audio.addEventListener("pause", () => {
      state.isPlaying = false;
      syncPlaybackUi();
      cancelAnimationFrame(animationFrame);
    });
    audio.addEventListener("ended", playNext);
    audio.addEventListener("error", onAudioError);
  }

  function syncAccountUi() {
    const displayName = String(currentUser.name || "Listener").trim() || "Listener";
    els.welcomeName.textContent = `Welcome, ${displayName}`;
  }

  function logout() {
    audio.pause();
    localStorage.removeItem(storageKeys.currentUser);
    window.location.href = "auth.html";
  }

  function onTrackGridClick(event) {
    const likeButton = event.target.closest("[data-like-id]");
    if (likeButton) {
      event.stopPropagation();
      toggleFavorite(Number(likeButton.dataset.likeId));
      return;
    }

    const card = event.target.closest("[data-song-id]");
    if (!card) return;
    playSongById(Number(card.dataset.songId));
  }

  function onTrackGridKeydown(event) {
    if (event.key !== "Enter" && event.key !== " ") return;

    const card = event.target.closest("[data-song-id]");
    if (!card) return;

    event.preventDefault();
    playSongById(Number(card.dataset.songId));
  }

  function playSongById(songId) {
    const index = songs.findIndex((song) => song.id === songId);
    if (index === -1) return;

    if (index === state.currentIndex) {
      playCurrent();
      return;
    }

    loadSong(index, true);
  }

  function renderView() {
    const isLibrary = state.activeView === "library";

    els.navItems.forEach((item) => {
      item.classList.toggle("is-active", item.dataset.view === state.activeView);
    });

    els.viewEyebrow.textContent = isLibrary ? "Library" : greeting();
    els.viewTitle.textContent = isLibrary ? "Liked Songs" : "Today's Mix";
    els.trackContext.textContent = isLibrary ? "Your Favorites" : "All Tracks";
    els.tracksHeading.textContent = isLibrary ? "Saved Collection" : "Featured Songs";

    renderSongs();
    updateFavoriteCount();
  }

  function renderSongs() {
    const visibleSongs = getVisibleSongs();
    els.resultCount.textContent = `${visibleSongs.length} ${visibleSongs.length === 1 ? "song" : "songs"}`;
    els.clearSearch.classList.toggle("is-visible", state.query.length > 0);
    els.emptyState.hidden = visibleSongs.length > 0;
    els.trackGrid.hidden = visibleSongs.length === 0;
    els.trackGrid.innerHTML = visibleSongs.map(renderSongCard).join("");
  }

  function renderSongCard(song) {
    const active = song.id === currentSong().id;
    const liked = state.favorites.has(song.id);
    const unavailable = state.unavailableIds.has(song.id);
    const safeName = escapeHtml(song.name);
    const safeArtist = escapeHtml(song.artist);
    const playIcon = active && state.isPlaying ? icons.pause : icons.play;

    return `
      <article class="track-card ${active ? "is-active" : ""} ${unavailable ? "is-unavailable" : ""}" data-song-id="${song.id}" tabindex="0" aria-label="${safeName} by ${safeArtist}">
        <div class="track-art-wrap">
          <img class="track-art" src="${coverFor(song)}" alt="${safeName} cover" loading="lazy" />
          <span class="playing-indicator" aria-hidden="true">
            <span></span><span></span><span></span>
          </span>
          <button class="card-play" type="button" aria-label="Play ${safeName}">
            <img src="${playIcon}" alt="" />
          </button>
        </div>
        <div class="track-info">
          <div>
            <h3>${safeName}</h3>
            <p>${safeArtist}</p>
          </div>
          <button class="icon-button card-like ${liked ? "is-liked" : ""}" type="button" data-like-id="${song.id}" aria-label="${liked ? "Unlike" : "Like"} ${safeName}">
            <img src="${liked ? icons.heartFilled : icons.heart}" alt="" />
          </button>
        </div>
      </article>
    `;
  }

  function getVisibleSongs() {
    const collection = state.activeView === "library"
      ? songs.filter((song) => state.favorites.has(song.id))
      : songs;

    if (!state.query) return collection;
    return collection.filter((song) => {
      return `${song.name} ${song.artist}`.toLowerCase().includes(state.query);
    });
  }

  function loadSong(index, shouldPlay) {
    state.currentIndex = normalizeIndex(index);
    state.requestedPlayback = shouldPlay;

    const song = currentSong();
    audio.src = song.file;
    audio.dataset.songId = String(song.id);
    audio.load();

    syncSongUi(song);
    updateProgress();
    renderSongs();

    if (shouldPlay) {
      playCurrent();
    }
  }

  async function togglePlayback() {
    if (audio.paused) {
      await playCurrent();
    } else {
      audio.pause();
    }
  }

  async function playCurrent() {
    if (state.unavailableIds.has(currentSong().id)) {
      if (state.unavailableIds.size >= songs.length) {
        stopPlayback("Audio unavailable");
        return;
      }

      playNext();
      return;
    }

    const requestedSongId = currentSong().id;
    state.requestedPlayback = true;

    try {
      await audio.play();
    } catch (error) {
      state.requestedPlayback = false;

      if (error.name !== "NotAllowedError") {
        markSongUnavailable(requestedSongId, error);
      } else {
        console.warn("Playback was blocked by the browser until a user gesture occurs.", error);
      }
    }
  }

  function playNext() {
    if (state.unavailableIds.size >= songs.length) {
      stopPlayback("Audio unavailable");
      return;
    }

    loadSong(nextPlayableIndex(1), true);
  }

  function playPrevious() {
    if (state.unavailableIds.size >= songs.length) {
      stopPlayback("Audio unavailable");
      return;
    }

    if (audio.currentTime > 4) {
      audio.currentTime = 0;
      updateProgress();
      return;
    }

    loadSong(nextPlayableIndex(-1), true);
  }

  function nextPlayableIndex(direction) {
    for (let offset = 1; offset <= songs.length; offset += 1) {
      const index = normalizeIndex(state.currentIndex + direction * offset);
      if (!state.unavailableIds.has(songs[index].id)) {
        return index;
      }
    }

    return state.currentIndex;
  }

  function onAudioError() {
    if (!audio.src) return;

    const failedSongId = Number(audio.dataset.songId);
    const shouldSkip = state.requestedPlayback || state.isPlaying;
    markSongUnavailable(failedSongId, audio.error);

    if (shouldSkip && currentSong().id === failedSongId) {
      if (state.unavailableIds.size >= songs.length) {
        stopPlayback("Audio unavailable");
      } else {
        playNext();
      }
    }
  }

  function markSongUnavailable(songId, error) {
    state.unavailableIds.add(songId);
    state.requestedPlayback = false;

    if (currentSong().id === songId) {
      state.isPlaying = false;
      els.heroEyebrow.textContent = "Audio unavailable";
      updateProgress();
      syncPlaybackUi();
    }

    renderSongs();
    const song = songs.find((item) => item.id === songId);
    console.warn(`Could not load ${song?.file || "selected audio"}. Check that the file exists.`, error);
  }

  function stopPlayback(message) {
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    state.isPlaying = false;
    state.requestedPlayback = false;
    els.heroEyebrow.textContent = message;
    updateProgress();
    syncPlaybackUi();
  }

  function syncSongUi(song) {
    setCover(els.heroCover, song);
    setCover(els.playerCover, song);

    els.heroTitle.textContent = song.name;
    els.heroArtist.textContent = song.artist;
    els.playerTitle.textContent = song.name;
    els.playerArtist.textContent = song.artist;
    els.heroEyebrow.textContent = state.unavailableIds.has(song.id)
      ? "Audio unavailable"
      : state.isPlaying
        ? "Now Playing"
        : "Selected Track";

    document.documentElement.style.setProperty("--cover-glow", coverGlow(song.id));
    syncFavoriteUi();
  }

  function setCover(image, song) {
    image.classList.add("is-switching");
    window.setTimeout(() => {
      image.src = coverFor(song);
      image.alt = `${song.name} cover`;
      image.classList.remove("is-switching");
    }, 90);
  }

  function onImageError(event) {
    const image = event.target;
    if (!(image instanceof HTMLImageElement)) return;

    const fallback = new URL(defaultCover, window.location.href).href;
    if (image.src === fallback) {
      image.src = embeddedCover;
      return;
    }

    image.src = defaultCover;
  }

  function syncPlaybackUi() {
    const icon = state.isPlaying ? icons.pause : icons.play;
    const label = state.isPlaying ? "Pause" : "Play";

    els.playPauseIcon.src = icon;
    els.heroPlayIcon.src = icon;
    els.heroPlayText.textContent = label;
    els.playPauseBtn.setAttribute("aria-label", label);
    if (!state.unavailableIds.has(currentSong().id)) {
      els.heroEyebrow.textContent = state.isPlaying ? "Now Playing" : "Selected Track";
    }
    renderSongs();
  }

  function syncFavoriteUi() {
    const song = currentSong();
    const liked = state.favorites.has(song.id);
    const icon = liked ? icons.heartFilled : icons.heart;
    const label = `${liked ? "Unlike" : "Like"} ${song.name}`;

    [els.heroFavorite, els.playerFavorite].forEach((button) => {
      button.classList.toggle("is-liked", liked);
      button.setAttribute("aria-label", label);
      button.querySelector("img").src = icon;
    });
  }

  function toggleFavorite(songId) {
    if (state.favorites.has(songId)) {
      state.favorites.delete(songId);
    } else {
      state.favorites.add(songId);
    }

    saveFavorites();
    syncFavoriteUi();
    updateFavoriteCount();
    renderSongs();
  }

  function updateFavoriteCount() {
    els.likedCount.textContent = state.favorites.size;
  }

  function previewSeek(event) {
    const duration = playableDuration();
    const ratio = Number(event.target.value) / 1000;

    setRangeFill(els.progressRange, ratio * 100);
    els.currentTime.textContent = formatTime(duration * ratio);
  }

  function commitSeek(event) {
    const duration = playableDuration();
    if (!duration) return;

    audio.currentTime = duration * (Number(event.target.value) / 1000);
    updateProgress();
  }

  function updateProgress() {
    const duration = playableDuration();
    const current = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    const ratio = duration ? current / duration : 0;

    els.progressRange.value = Math.round(ratio * 1000);
    setRangeFill(els.progressRange, ratio * 100);
    els.currentTime.textContent = formatTime(current);
    els.durationTime.textContent = formatTime(duration);
  }

  function startProgressLoop() {
    cancelAnimationFrame(animationFrame);

    const tick = () => {
      updateProgress();
      if (!audio.paused) {
        animationFrame = requestAnimationFrame(tick);
      }
    };

    animationFrame = requestAnimationFrame(tick);
  }

  function setVolume(volume) {
    const safeVolume = Math.max(0, Math.min(1, Number.isFinite(volume) ? volume : 0.72));
    audio.volume = safeVolume;
    audio.muted = safeVolume === 0;
    els.volumeRange.value = safeVolume;
    setRangeFill(els.volumeRange, safeVolume * 100);
    els.volumeIcon.src = audio.muted ? icons.mute : icons.volume;
    els.muteBtn.setAttribute("aria-label", audio.muted ? "Unmute" : "Mute");
    localStorage.setItem(storageKeys.volume, String(safeVolume));
  }

  function toggleMute() {
    if (audio.muted || audio.volume === 0) {
      setVolume(Number(localStorage.getItem(storageKeys.lastVolume)) || 0.72);
      return;
    }

    localStorage.setItem(storageKeys.lastVolume, String(audio.volume));
    audio.muted = true;
    els.volumeRange.value = 0;
    setRangeFill(els.volumeRange, 0);
    els.volumeIcon.src = icons.mute;
    els.muteBtn.setAttribute("aria-label", "Unmute");
  }

  function disablePlayer() {
    els.trackGrid.innerHTML = "";
    els.emptyState.hidden = false;
    els.resultCount.textContent = "0 songs";
    [els.playPauseBtn, els.heroPlay, els.prevBtn, els.nextBtn, els.progressRange].forEach((el) => {
      el.disabled = true;
    });
  }

  function keepOnlyValidFavorites() {
    const validIds = new Set(songs.map((song) => song.id));
    state.favorites = new Set([...state.favorites].filter((id) => validIds.has(id)));
    saveFavorites();
  }

  function readStoredVolume() {
    const saved = Number(localStorage.getItem(storageKeys.volume));
    return Number.isFinite(saved) ? saved : 0.72;
  }

  function getCurrentUser() {
    try {
      const user = JSON.parse(localStorage.getItem(storageKeys.currentUser) || "null");
      return user && user.email ? user : null;
    } catch {
      localStorage.removeItem(storageKeys.currentUser);
      return null;
    }
  }

  function redirectToLogin() {
    window.location.replace("auth.html");
  }

  function loadFavorites() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKeys.favorites) || "[]");
      return new Set(saved.map(Number).filter(Number.isFinite));
    } catch {
      return new Set();
    }
  }

  function saveFavorites() {
    localStorage.setItem(storageKeys.favorites, JSON.stringify([...state.favorites]));
  }

  function coverFor(song) {
    return song.cover || defaultCover;
  }

  function currentSong() {
    return songs[state.currentIndex];
  }

  function normalizeIndex(index) {
    return (index + songs.length) % songs.length;
  }

  function playableDuration() {
    return Number.isFinite(audio.duration) ? audio.duration : 0;
  }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60).toString().padStart(2, "0");
    return `${minutes}:${remainingSeconds}`;
  }

  function greeting() {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 18) return "Good Afternoon";
    return "Good Evening";
  }

  function coverGlow(id) {
    const glows = [
      "rgba(42, 210, 159, 0.28)",
      "rgba(255, 167, 89, 0.24)",
      "rgba(229, 92, 122, 0.24)",
      "rgba(105, 209, 255, 0.22)",
      "rgba(232, 211, 122, 0.2)"
    ];

    return glows[id % glows.length];
  }

  function setRangeFill(input, value) {
    input.style.setProperty("--value", `${Math.max(0, Math.min(100, value))}%`);
  }

  function escapeHtml(value) {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  init();
})();
