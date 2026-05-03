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
    lastVolume: "harmony:last-volume",
    playlists: "harmony:playlists"
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
    volumeIcon: document.getElementById("volumeIcon"),
    // Playlist elements
    createPlaylistBtn: document.getElementById("createPlaylistBtn"),
    playlistsList: document.getElementById("playlistsList"),
    createPlaylistModal: document.getElementById("createPlaylistModal"),
    playlistNameInput: document.getElementById("playlistNameInput"),
    playlistNameError: document.getElementById("playlistNameError"),
    confirmPlaylistBtn: document.getElementById("confirmPlaylistBtn"),
    cancelPlaylistBtn: document.getElementById("cancelPlaylistBtn"),
    addSongsModal: document.getElementById("addSongsModal"),
    addSongsSearch: document.getElementById("addSongsSearch"),
    addSongsList: document.getElementById("addSongsList"),
    addSongsEmpty: document.getElementById("addSongsEmpty"),
    closeAddSongsBtn: document.getElementById("closeAddSongsBtn"),
    addSongsTitle: document.getElementById("addSongsTitle")
  };

  const state = {
    currentIndex: 0,
    activeView: "home",
    query: "",
    isPlaying: false,
    requestedPlayback: false,
    favorites: loadFavorites(),
    unavailableIds: new Set(),
    playlists: loadPlaylists(),
    activePlaylistId: null,
    addSongsPlaylistId: null
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
    initializePlaylists();
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

    const removeButton = event.target.closest(".remove-from-playlist-btn");
    if (removeButton) {
      event.stopPropagation();
      const songId = Number(removeButton.dataset.songId);
      removeSongFromPlaylist(state.activePlaylistId, songId);
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

  // Playlist Functions
  function initializePlaylists() {
    renderPlaylistsList();
    bindPlaylistEvents();
  }

  function bindPlaylistEvents() {
    els.createPlaylistBtn.addEventListener("click", openCreatePlaylistModal);
    els.confirmPlaylistBtn.addEventListener("click", createPlaylist);
    els.cancelPlaylistBtn.addEventListener("click", closeCreatePlaylistModal);
    els.closeAddSongsBtn.addEventListener("click", closeAddSongsModal);

    // Modal close buttons
    document.querySelectorAll(".modal-close").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const modal = e.target.closest(".modal-overlay");
        if (modal) modal.hidden = true;
      });
    });

    // Modal overlay click to close
    document.querySelectorAll(".modal-overlay").forEach((modal) => {
      modal.addEventListener("click", (e) => {
        if (e.target === modal) modal.hidden = true;
      });
    });

    // Playlist name input - allow Enter key to create
    els.playlistNameInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        createPlaylist();
      }
    });

    // Add songs search
    els.addSongsSearch.addEventListener("input", (e) => {
      renderAvailableSongsForPlaylist(e.target.value.toLowerCase());
    });
  }

  function openCreatePlaylistModal() {
    els.playlistNameInput.value = "";
    els.playlistNameError.hidden = true;
    els.createPlaylistModal.hidden = false;
    els.playlistNameInput.focus();
  }

  function closeCreatePlaylistModal() {
    els.createPlaylistModal.hidden = true;
  }

  function createPlaylist() {
    const name = els.playlistNameInput.value.trim();

    if (!name) {
      els.playlistNameError.textContent = "Playlist name cannot be empty";
      els.playlistNameError.hidden = false;
      return;
    }

    if (name.length > 50) {
      els.playlistNameError.textContent = "Playlist name must be 50 characters or less";
      els.playlistNameError.hidden = false;
      return;
    }

    const playlistId = Date.now();
    const playlist = {
      id: playlistId,
      name: name,
      songs: [],
      createdAt: new Date().toISOString()
    };

    state.playlists.push(playlist);
    savePlaylists();
    renderPlaylistsList();
    closeCreatePlaylistModal();
  }

  function deletePlaylist(playlistId) {
    if (!confirm("Are you sure you want to delete this playlist?")) return;

    state.playlists = state.playlists.filter((p) => p.id !== playlistId);
    if (state.activePlaylistId === playlistId) {
      state.activePlaylistId = null;
      state.activeView = "home";
      state.query = "";
      els.searchInput.value = "";
      renderView();
    }
    savePlaylists();
    renderPlaylistsList();
  }

  function openAddSongsModal(playlistId) {
    state.addSongsPlaylistId = playlistId;
    const playlist = state.playlists.find((p) => p.id === playlistId);
    if (!playlist) return;

    els.addSongsTitle.textContent = `Add Songs to "${escapeHtml(playlist.name)}"`;
    els.addSongsSearch.value = "";
    els.addSongsModal.hidden = false;
    renderAvailableSongsForPlaylist("");
  }

  function closeAddSongsModal() {
    els.addSongsModal.hidden = true;
    state.addSongsPlaylistId = null;
  }

  function renderAvailableSongsForPlaylist(query) {
    const playlistId = state.addSongsPlaylistId;
    const playlist = state.playlists.find((p) => p.id === playlistId);
    if (!playlist) return;

    const playlistSongIds = new Set(playlist.songs.map((s) => s.id));
    let availableSongs = songs.filter((song) => !playlistSongIds.has(song.id));

    if (query) {
      availableSongs = availableSongs.filter((song) =>
        `${song.name} ${song.artist}`.toLowerCase().includes(query)
      );
    }

    els.addSongsEmpty.hidden = availableSongs.length > 0;
    els.addSongsList.hidden = availableSongs.length === 0;

    els.addSongsList.innerHTML = availableSongs
      .map((song) => `
        <div class="song-item">
          <img src="${coverFor(song)}" alt="${escapeHtml(song.name)} cover" />
          <div class="song-info">
            <p class="song-info-title">${escapeHtml(song.name)}</p>
            <p class="song-info-artist">${escapeHtml(song.artist)}</p>
          </div>
          <button class="add-song-btn" data-song-id="${song.id}" type="button" aria-label="Add ${escapeHtml(song.name)} to playlist">
            <img src="assets/icons/add.svg" alt="" />
          </button>
        </div>
      `)
      .join("");

    // Bind add song buttons
    els.addSongsList.querySelectorAll(".add-song-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const songId = Number(e.currentTarget.dataset.songId);
        addSongToPlaylist(playlistId, songId);
      });
    });
  }

  function addSongToPlaylist(playlistId, songId) {
    const playlist = state.playlists.find((p) => p.id === playlistId);
    const song = songs.find((s) => s.id === songId);

    if (!playlist || !song) return;

    // Check if song already exists in playlist
    if (playlist.songs.find((s) => s.id === songId)) return;

    playlist.songs.push(song);
    savePlaylists();
    renderAvailableSongsForPlaylist(els.addSongsSearch.value.toLowerCase());
  }

  function removeSongFromPlaylist(playlistId, songId) {
    const playlist = state.playlists.find((p) => p.id === playlistId);
    if (!playlist) return;

    playlist.songs = playlist.songs.filter((s) => s.id !== songId);
    savePlaylists();

    if (state.activePlaylistId === playlistId) {
      renderSongs();
    }
  }

  function selectPlaylist(playlistId) {
    state.activePlaylistId = playlistId;
    state.activeView = "playlist";
    state.query = "";
    els.searchInput.value = "";
    renderView();
    renderPlaylistsList();
  }

  function renderPlaylistsList() {
    els.playlistsList.innerHTML = state.playlists
      .map((playlist) => `
        <li class="playlist-item ${state.activePlaylistId === playlist.id ? "is-active" : ""}" data-playlist-id="${playlist.id}">
          <span class="playlist-name">${escapeHtml(playlist.name)}</span>
          <div class="playlist-actions">
            <button class="playlist-action-btn add-songs-btn" type="button" aria-label="Add songs to playlist" title="Add songs">
              <img src="assets/icons/add.svg" alt="" />
            </button>
            <button class="playlist-action-btn delete-playlist-btn" type="button" aria-label="Delete playlist" title="Delete">
              <img src="assets/icons/close.svg" alt="" />
            </button>
          </div>
        </li>
      `)
      .join("");

    // Bind playlist item click
    els.playlistsList.querySelectorAll(".playlist-item").forEach((item) => {
      item.addEventListener("click", (e) => {
        if (!e.target.closest("button")) {
          selectPlaylist(Number(item.dataset.playlistId));
        }
      });
    });

    // Bind add songs buttons
    els.playlistsList.querySelectorAll(".add-songs-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const playlistId = Number(e.closest(".playlist-item").dataset.playlistId);
        openAddSongsModal(playlistId);
      });
    });

    // Bind delete buttons
    els.playlistsList.querySelectorAll(".delete-playlist-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const playlistId = Number(e.closest(".playlist-item").dataset.playlistId);
        deletePlaylist(playlistId);
      });
    });
  }

  function getVisibleSongs() {
    let collection;

    if (state.activeView === "playlist") {
      const playlist = state.playlists.find((p) => p.id === state.activePlaylistId);
      collection = playlist ? playlist.songs : [];
    } else if (state.activeView === "library") {
      collection = songs.filter((song) => state.favorites.has(song.id));
    } else {
      collection = songs;
    }

    if (!state.query) return collection;
    return collection.filter((song) => {
      return `${song.name} ${song.artist}`.toLowerCase().includes(state.query);
    });
  }

  function renderView() {
    const isLibrary = state.activeView === "library";
    const isPlaylist = state.activeView === "playlist";
    const currentPlaylist = state.playlists.find((p) => p.id === state.activePlaylistId);

    els.navItems.forEach((item) => {
      item.classList.remove("is-active");
    });

    if (isPlaylist) {
      els.viewEyebrow.textContent = "Playlist";
      els.viewTitle.textContent = currentPlaylist?.name || "Playlist";
      els.trackContext.textContent = "Playlist Songs";
      els.tracksHeading.textContent = `${currentPlaylist?.songs.length || 0} song${currentPlaylist?.songs.length !== 1 ? "s" : ""}`;
    } else if (isLibrary) {
      els.navItems.forEach((item) => {
        if (item.dataset.view === "library") item.classList.add("is-active");
      });
      els.viewEyebrow.textContent = "Library";
      els.viewTitle.textContent = "Liked Songs";
      els.trackContext.textContent = "Your Favorites";
      els.tracksHeading.textContent = "Saved Collection";
    } else {
      els.navItems.forEach((item) => {
        if (item.dataset.view === "home") item.classList.add("is-active");
      });
      els.viewEyebrow.textContent = greeting();
      els.viewTitle.textContent = "Today's Mix";
      els.trackContext.textContent = "All Tracks";
      els.tracksHeading.textContent = "Featured Songs";
    }

    renderSongs();
    updateFavoriteCount();
  }

  function renderSongCard(song) {
    const active = song.id === currentSong().id;
    const liked = state.favorites.has(song.id);
    const unavailable = state.unavailableIds.has(song.id);
    const safeName = escapeHtml(song.name);
    const safeArtist = escapeHtml(song.artist);
    const playIcon = active && state.isPlaying ? icons.pause : icons.play;

    let removeButton = "";
    if (state.activeView === "playlist") {
      removeButton = `
        <button class="icon-button remove-from-playlist-btn" type="button" data-song-id="${song.id}" aria-label="Remove ${safeName} from playlist">
          <img src="assets/icons/close.svg" alt="" />
        </button>
      `;
    }

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
          <div class="track-card-actions">
            ${removeButton}
            <button class="icon-button card-like ${liked ? "is-liked" : ""}" type="button" data-like-id="${song.id}" aria-label="${liked ? "Unlike" : "Like"} ${safeName}">
              <img src="${liked ? icons.heartFilled : icons.heart}" alt="" />
            </button>
          </div>
        </div>
      </article>
    `;
  }

  function renderSongs() {
    const visibleSongs = getVisibleSongs();
    els.resultCount.textContent = `${visibleSongs.length} ${visibleSongs.length === 1 ? "song" : "songs"}`;
    els.clearSearch.classList.toggle("is-visible", state.query.length > 0);
    els.emptyState.hidden = visibleSongs.length > 0;
    els.trackGrid.hidden = visibleSongs.length === 0;
    els.trackGrid.innerHTML = visibleSongs.map(renderSongCard).join("");

    // Bind remove from playlist buttons
    els.trackGrid.querySelectorAll(".remove-from-playlist-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const songId = Number(btn.dataset.songId);
        removeSongFromPlaylist(state.activePlaylistId, songId);
      });
    });
  }

  function loadPlaylists() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKeys.playlists) || "[]");
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  }

  function savePlaylists() {
    localStorage.setItem(storageKeys.playlists, JSON.stringify(state.playlists));
  }

  init();
})();
