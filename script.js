(() => {
  const songs = window.HARMONY_SONGS || [];
  const storageKeys = {
    favorites: "harmony:favorites",
    volume: "harmony:volume"
  };

  const icons = {
    play: "assets/icons/play.svg",
    pause: "assets/icons/pause.svg",
    heart: "assets/icons/heart.svg",
    heartFilled: "assets/icons/heart-filled.svg",
    volume: "assets/icons/volume.svg",
    mute: "assets/icons/mute.svg"
  };

  const audio = document.getElementById("audio");
  const state = {
    currentIndex: 0,
    activeView: "home",
    query: "",
    isPlaying: false,
    pendingPlay: false,
    syntheticUrl: "",
    favorites: loadFavorites()
  };

  const els = {
    navItems: document.querySelectorAll(".nav-item"),
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

  let animationFrame = 0;
  let wasPlayingBeforeSeek = false;

  function init() {
    if (!songs.length) return;

    const savedVolume = Number(localStorage.getItem(storageKeys.volume));
    setVolume(Number.isFinite(savedVolume) ? savedVolume : 0.72);
    bindEvents();
    loadSong(0, false);
    renderView();
  }

  function bindEvents() {
    els.trackGrid.addEventListener("click", handleTrackClick);
    els.searchInput.addEventListener("input", handleSearch);
    els.clearSearch.addEventListener("click", clearSearch);

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

    els.progressRange.addEventListener("pointerdown", () => {
      wasPlayingBeforeSeek = state.isPlaying;
    });
    els.progressRange.addEventListener("input", previewSeek);
    els.progressRange.addEventListener("change", commitSeek);

    els.volumeRange.addEventListener("input", (event) => {
      setVolume(Number(event.target.value));
    });

    audio.addEventListener("loadedmetadata", updateProgress);
    audio.addEventListener("timeupdate", updateProgress);
    audio.addEventListener("play", () => {
      state.isPlaying = true;
      syncPlaybackUi();
      startProgressLoop();
    });
    audio.addEventListener("pause", () => {
      state.isPlaying = false;
      syncPlaybackUi();
      cancelAnimationFrame(animationFrame);
    });
    audio.addEventListener("ended", playNext);
    audio.addEventListener("error", handleAudioError);
  }

  function handleTrackClick(event) {
    const likeButton = event.target.closest("[data-like-id]");
    if (likeButton) {
      event.stopPropagation();
      toggleFavorite(Number(likeButton.dataset.likeId));
      return;
    }

    const card = event.target.closest("[data-song-id]");
    if (!card) return;

    const songId = Number(card.dataset.songId);
    const songIndex = songs.findIndex((song) => song.id === songId);
    if (songIndex === -1) return;

    if (songIndex === state.currentIndex) {
      playCurrent();
      return;
    }

    loadSong(songIndex, true);
  }

  function handleSearch(event) {
    state.query = event.target.value.trim().toLowerCase();
    renderSongs();
  }

  function clearSearch() {
    state.query = "";
    els.searchInput.value = "";
    renderSongs();
    els.searchInput.focus();
  }

  function renderView() {
    els.navItems.forEach((item) => {
      item.classList.toggle("is-active", item.dataset.view === state.activeView);
    });

    const isLibrary = state.activeView === "library";
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
    const isActive = song.id === currentSong().id;
    const isLiked = state.favorites.has(song.id);
    const playIcon = state.isPlaying && isActive ? icons.pause : icons.play;
    const safeName = escapeHtml(song.name);
    const safeArtist = escapeHtml(song.artist);

    return `
      <article class="track-card ${isActive ? "is-active" : ""}" data-song-id="${song.id}" tabindex="0" aria-label="${safeName} by ${safeArtist}">
        <div class="track-art-wrap">
          <img class="track-art" src="${song.cover}" alt="${safeName} cover" loading="lazy" />
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
          <button class="icon-button card-like ${isLiked ? "is-liked" : ""}" type="button" data-like-id="${song.id}" aria-label="${isLiked ? "Unlike" : "Like"} ${safeName}">
            <img src="${isLiked ? icons.heartFilled : icons.heart}" alt="" />
          </button>
        </div>
      </article>
    `;
  }

  function getVisibleSongs() {
    const baseSongs = state.activeView === "library"
      ? songs.filter((song) => state.favorites.has(song.id))
      : songs;

    if (!state.query) return baseSongs;
    return baseSongs.filter((song) => song.name.toLowerCase().includes(state.query));
  }

  function loadSong(index, shouldPlay) {
    state.currentIndex = normalizeIndex(index);
    state.pendingPlay = shouldPlay;

    const song = currentSong();
    revokeSyntheticUrl();
    audio.dataset.synthetic = "false";
    audio.src = song.file;
    audio.load();

    syncSongUi(song);
    renderSongs();
    updateProgress();

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
    state.pendingPlay = true;

    try {
      await audio.play();
    } catch (error) {
      if (audio.dataset.synthetic !== "true") {
        useSyntheticSource();
        try {
          await audio.play();
        } catch (secondError) {
          console.warn("Harmony could not start playback.", secondError);
        }
      } else {
        console.warn("Harmony could not start playback.", error);
      }
    } finally {
      state.pendingPlay = false;
    }
  }

  function playNext() {
    loadSong(state.currentIndex + 1, true);
  }

  function playPrevious() {
    if (audio.currentTime > 4) {
      audio.currentTime = 0;
      updateProgress();
      return;
    }

    loadSong(state.currentIndex - 1, true);
  }

  function handleAudioError() {
    if (!state.pendingPlay || audio.dataset.synthetic === "true") return;
    useSyntheticSource();
    playCurrent();
  }

  function useSyntheticSource() {
    revokeSyntheticUrl();
    state.syntheticUrl = URL.createObjectURL(createDemoAudioBlob(currentSong().id));
    audio.dataset.synthetic = "true";
    audio.src = state.syntheticUrl;
    audio.load();
  }

  function syncSongUi(song) {
    const imageTargets = [els.heroCover, els.playerCover];
    imageTargets.forEach((image) => image.classList.add("is-switching"));

    window.setTimeout(() => {
      els.heroCover.src = song.cover;
      els.playerCover.src = song.cover;
      els.heroCover.alt = `${song.name} cover`;
      els.playerCover.alt = `${song.name} cover`;
      imageTargets.forEach((image) => image.classList.remove("is-switching"));
    }, 120);

    els.heroTitle.textContent = song.name;
    els.heroArtist.textContent = song.artist;
    els.playerTitle.textContent = song.name;
    els.playerArtist.textContent = song.artist;
    els.heroEyebrow.textContent = state.isPlaying ? "Now Playing" : "Selected Track";
    document.documentElement.style.setProperty("--cover-glow", coverGlow(song.id));
    syncFavoriteUi();
  }

  function syncPlaybackUi() {
    const isPlaying = state.isPlaying;
    const icon = isPlaying ? icons.pause : icons.play;
    const label = isPlaying ? "Pause" : "Play";

    els.playPauseIcon.src = icon;
    els.heroPlayIcon.src = icon;
    els.heroPlayText.textContent = label;
    els.playPauseBtn.setAttribute("aria-label", label);
    els.heroEyebrow.textContent = isPlaying ? "Now Playing" : "Selected Track";
    renderSongs();
  }

  function syncFavoriteUi() {
    const song = currentSong();
    const isLiked = state.favorites.has(song.id);
    const icon = isLiked ? icons.heartFilled : icons.heart;
    const label = `${isLiked ? "Unlike" : "Like"} ${song.name}`;

    [els.heroFavorite, els.playerFavorite].forEach((button) => {
      button.classList.toggle("is-liked", isLiked);
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
    const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    const ratio = Number(event.target.value) / 1000;
    const nextTime = duration * ratio;

    setRangeFill(els.progressRange, ratio * 100);
    els.currentTime.textContent = formatTime(nextTime);
  }

  function commitSeek(event) {
    const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    if (!duration) return;

    audio.currentTime = duration * (Number(event.target.value) / 1000);
    updateProgress();

    if (wasPlayingBeforeSeek) {
      playCurrent();
    }
  }

  function updateProgress() {
    const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
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
    const safeVolume = Math.max(0, Math.min(1, volume));
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
      setVolume(Number(localStorage.getItem(storageKeys.volume)) || 0.72);
    } else {
      localStorage.setItem(storageKeys.volume, String(audio.volume));
      audio.muted = true;
      els.volumeRange.value = 0;
      setRangeFill(els.volumeRange, 0);
      els.volumeIcon.src = icons.mute;
      els.muteBtn.setAttribute("aria-label", "Unmute");
    }
  }

  function createDemoAudioBlob(seed) {
    const sampleRate = 44100;
    const duration = 18 + (seed % 8);
    const sampleCount = sampleRate * duration;
    const bytesPerSample = 2;
    const dataLength = sampleCount * bytesPerSample;
    const buffer = new ArrayBuffer(44 + dataLength);
    const view = new DataView(buffer);
    const writeString = (offset, value) => {
      for (let i = 0; i < value.length; i += 1) {
        view.setUint8(offset + i, value.charCodeAt(i));
      }
    };

    writeString(0, "RIFF");
    view.setUint32(4, 36 + dataLength, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * bytesPerSample, true);
    view.setUint16(32, bytesPerSample, true);
    view.setUint16(34, 16, true);
    writeString(36, "data");
    view.setUint32(40, dataLength, true);

    const root = 130 + seed * 7;
    const fifth = root * 1.5;
    const top = root * 2;
    const beat = 0.82 + (seed % 5) * 0.025;

    for (let i = 0; i < sampleCount; i += 1) {
      const t = i / sampleRate;
      const fadeIn = Math.min(1, t / 1.2);
      const fadeOut = Math.min(1, (duration - t) / 1.5);
      const envelope = Math.max(0, Math.min(fadeIn, fadeOut));
      const pulse = 0.72 + 0.28 * Math.sin(2 * Math.PI * beat * t);
      const wave =
        Math.sin(2 * Math.PI * root * t) * 0.35 +
        Math.sin(2 * Math.PI * fifth * t) * 0.22 +
        Math.sin(2 * Math.PI * top * t) * 0.13;
      const sample = Math.max(-1, Math.min(1, wave * pulse * envelope));
      view.setInt16(44 + i * 2, sample * 0x7fff, true);
    }

    return new Blob([buffer], { type: "audio/wav" });
  }

  function currentSong() {
    return songs[state.currentIndex];
  }

  function normalizeIndex(index) {
    return (index + songs.length) % songs.length;
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

  function setRangeFill(input, value) {
    input.style.setProperty("--value", `${Math.max(0, Math.min(100, value))}%`);
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

  function revokeSyntheticUrl() {
    if (!state.syntheticUrl) return;
    URL.revokeObjectURL(state.syntheticUrl);
    state.syntheticUrl = "";
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
