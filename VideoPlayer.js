/* eslint-disable curly */
import React, {Component} from 'react';
import Video from 'react-native-video';
import {
  TouchableWithoutFeedback,
  TouchableHighlight,
  ImageBackground,
  PanResponder,
  StyleSheet,
  Animated,
  SafeAreaView,
  Easing,
  Image,
  View,
  Text,
  Platform,
} from 'react-native';
import padStart from 'lodash/padStart';

export default class VideoPlayer extends Component {
  static defaultProps = {
    toggleResizeModeOnFullscreen: true,
    controlAnimationTiming: 500,
    doubleTapTime: 130,
    skipTime: 10,
    playInBackground: false,
    playWhenInactive: false,
    resizeMode: 'contain',
    isFullscreen: false,
    showOnStart: true,
    paused: false,
    repeat: false,
    muted: false,
    volume: 1,
    title: '',
    videoResolution: '480p',
    videoSources: [],
    rate: 1,
    showTimeRemaining: true,
    showHours: false,
    isCasting: false,
    elapsedTime: 0,
    googleCastButton: null,
    headers: {}
  };

  constructor(props) {
    super(props);

    /**
     * All of our values that are updated by the
     * methods and listeners in this class
     */

    const videoSource =
      this.props.videoSources.find(
        vs => vs.videoResolution === this.props.videoResolution,
      ) ?? this.props.videoSources[0];

    this.state = {
      // Video
      resizeMode: this.props.resizeMode,
      paused: this.props.paused,
      muted: this.props.muted,
      volume: this.props.volume,
      rate: this.props.rate,
      resetRate: Platform.OS === 'android',
      videoResolution:
        this.props.videoResolution ||
        this.props.videoSources[0]?.videoResolution,
      changingVideoResolution: false,
      // Controls

      isFullscreen:
        this.props.isFullScreen || this.props.resizeMode === 'cover' || false,
      width: 0,
      showTimeRemaining: this.props.showTimeRemaining,
      showHours: this.props.showHours,
      volumeTrackWidth: 0,
      volumeFillWidth: 0,
      seekerFillWidth: 0,
      showControls: this.props.showOnStart,
      volumePosition: 0,
      seekerPosition: 0,
      volumeOffset: 0,
      seekerOffset: 0,
      seeking: false,
      originallyPaused: false,
      scrubbing: false,
      loading: false,
      currentTime: 0,
      error: false,
      duration: 0,
      source: {uri: videoSource?.uri},
      headers: this.props.headers
    };

    /**
     * Any options that can be set at init.
     */
    this.opts = {
      playWhenInactive: this.props.playWhenInactive,
      playInBackground: this.props.playInBackground,
      repeat: this.props.repeat,
      title: this.props.title,
    };

    /**
     * Our app listeners and associated methods
     */
    this.events = {
      onError: this.props.onError || this._onError.bind(this),
      onBack: this.props.onBack || this._onBack.bind(this),
      onEnd: this.props.onEnd || this._onEnd.bind(this),
      onScreenTouch: this._onScreenTouch.bind(this),
      onEnterFullscreen: this.props.onEnterFullscreen,
      onExitFullscreen: this.props.onExitFullscreen,
      onShowControls: this.props.onShowControls,
      onHideControls: this.props.onHideControls,
      onLoadStart: this._onLoadStart.bind(this),
      onProgress: this._onProgress.bind(this),
      onSeek: this._onSeek.bind(this),
      onSeekStarted: this.props.onSeekStarted,
      onLoad: this._onLoad.bind(this),
      onDoublePress: this._onDoublePress.bind(this),
      onPause: this.props.onPause,
      onPlay: this.props.onPlay,
      onVideoResolutionChange: this.props.onVideoResolutionChange,
      onRateChange: this.props.onRateChange,
      onComponentLayout: this._onComponentLayout.bind(this),
      onPressResolution: this.props.onPressResolution,
    };

    /**
     * Functions used throughout the application
     */
    this.methods = {
      toggleFullscreen: this._toggleFullscreen.bind(this),
      togglePlayPause: this._togglePlayPause.bind(this),
      toggleControls: this._toggleControls.bind(this),
      toggleTimer: this._toggleTimer.bind(this),
      toggleRate: this._toggleRate.bind(this),
      toggleVideoResolution: this._toggleVideoResolution.bind(this),
    };

    /**
     * Player information
     */
    this.player = {
      controlTimeoutDelay: this.props.controlTimeout || 15000,
      volumePanResponder: PanResponder,
      seekPanResponder: PanResponder,
      controlTimeout: null,
      tapActionTimeout: null,
      volumeWidth: 150,
      iconOffset: 0,
      seekerWidth: 0,
      ref: Video,
      scrubbingTimeStep: this.props.scrubbing || 0,
      tapAnywhereToPause: this.props.tapAnywhereToPause,
    };

    /**
     * Various animations
     */
    const initialValue = this.props.showOnStart ? 1 : 0;

    this.animations = {
      bottomControl: {
        marginBottom: new Animated.Value(0),
        opacity: new Animated.Value(initialValue),
      },
      topControl: {
        marginTop: new Animated.Value(0),
        opacity: new Animated.Value(initialValue),
      },
      video: {
        opacity: new Animated.Value(1),
      },
      loader: {
        rotate: new Animated.Value(0),
        MAX_VALUE: 360,
      },
      leftDoublePress: {
        opacity: new Animated.Value(0),
      },
      rightDoublePress: {
        opacity: new Animated.Value(0),
      },
    };

    /**
     * Various styles that be added...
     */
    this.styles = {
      videoStyle: this.props.videoStyle || {},
      containerStyle: this.props.style || {},
    };
  }

  componentDidUpdate = prevProps => {
    const {isFullscreen, videoResolution} = this.props;

    if (prevProps.isFullscreen !== isFullscreen) {
      this.setState({isFullscreen});
    }

    if (prevProps.videoResolution !== videoResolution) {
      this.setState({videoResolution});
    }
  };


  /**
   * Select video resolution by index
   * @param index
   */
  selectVideoResolutionByIndex(index) {
    const { videoSources } = this.props;
    if (index < 0 || index >= videoSources.length) {
      console.warn('Invalid index for video resolution');
      return;
    }

    const { videoResolution, uri } = videoSources[index];

    let state = this.state;
    state.videoResolution = videoResolution;
    state.source = { uri };
    state.changingVideoResolution = true;
    this.setState(state);

    if (typeof this.events.onVideoResolutionChange === 'function') {
      this.events.onVideoResolutionChange(videoResolution);
    }
  }

  /**
    | -------------------------------------------------------
    | Events
    | -------------------------------------------------------
    |
    | These are the events that the <Video> component uses
    | and can be overridden by assigning it as a prop.
    | It is suggested that you override onEnd.
    |
    */

  /**
   * When load starts we display a loading icon
   * and show the controls.
   */
  _onLoadStart() {
    let state = this.state;
    state.loading = true;
    this.loadAnimation();
    this.setState(state);

    if (typeof this.props.onLoadStart === 'function') {
      this.props.onLoadStart(...arguments);
    }
    console.log('onLoadStart', this.state.source.uri);
  }

  /**
   * When load is finished we hide the load icon
   * and hide the controls. We also set the
   * video duration.
   *
   * @param {object} data The video meta data
   */
  _onLoad(data = {}) {
    let state = this.state;

    if (state.changingVideoResolution) {
      console.log('restorePreviousTime', state.currentTime);
      this.seekTo(state.currentTime);
    }

    state.duration = data.duration;
    state.loading = false;
    this.setState(state);

    if (state.showControls) {
      this.resetControlTimeout();
    }

    this.flashBackwardForwardButtons();

    if (typeof this.props.onLoad === 'function') {
      this.props.onLoad(...arguments);
    }
  }

  /**
   * For onprogress we fire listeners that
   * update our seekbar and timer.
   *
   * @param {object} data The video meta data
   */
  _onProgress(data = {}) {
    let state = this.state;

    //Android MediaPlayer fix for rate bug after source change
    if (this.state.resetRate) {
      state.resetRate = false;
    }

    if (state.changingVideoResolution && data.currentTime === 0) {
      this.setState({changingVideoResolution: false});
      return;
    }

    if (!state.scrubbing) {
      state.currentTime = data.currentTime;

      if (!state.seeking) {
        const position = this.calculateSeekerPosition();
        this.setSeekerPosition(position);
      }

      if (typeof this.props.onProgress === 'function') {
        this.props.onProgress(...arguments);
      }

      this.setState(state);
    }
  }

  /**
   * For onSeek we clear scrubbing if set.
   *
   * @param {object} data The video meta data
   */
  _onSeek(data = {}) {
    let state = this.state;
    if (state.scrubbing) {
      state.scrubbing = false;
      state.currentTime = data.currentTime;

      // Seeking may be false here if the user released the seek bar while the player was still processing
      // the last seek command. In this case, perform the steps that have been postponed.
      if (!state.seeking) {
        this.setControlTimeout();
        state.paused = state.originallyPaused;
      }

      this.setState(state);
    }
    if (typeof this.props.onSeek === 'function') {
      this.props.onSeek(...arguments);
    }
  }

  /**
   * It is suggested that you override this
   * command so your app knows what to do.
   * Either close the video or go to a
   * new page.
   */
  _onEnd() {}

  /**
   * Set the error state to true which then
   * changes our renderError function
   *
   * @param {object} err  Err obj returned from <Video> component
   */
  _onError(_err) {
    let state = this.state;
    state.error = true;
    state.loading = false;

    this.setState(state);
  }

  /**
   * This is a single and double tap listener
   * when the user taps the screen anywhere.
   * One tap toggles controls and/or toggles pause,
   * two toggles fullscreen mode.
   */
  _onScreenTouch(touchEvent) {
    if (this.player.tapActionTimeout) {
      console.log(touchEvent.nativeEvent);
      clearTimeout(this.player.tapActionTimeout);
      this.player.tapActionTimeout = 0;
      // this.methods.toggleFullscreen();
      this.events.onDoublePress(touchEvent.nativeEvent);
      const state = this.state;
      if (state.showControls) {
        this.resetControlTimeout();
      }
    } else {
      this.player.tapActionTimeout = setTimeout(() => {
        const state = this.state;
        if (this.player.tapAnywhereToPause && state.showControls) {
          this.methods.togglePlayPause();
          this.resetControlTimeout();
        } else {
          this.methods.toggleControls();
        }
        this.player.tapActionTimeout = 0;
      }, this.props.doubleTapTime);
    }
  }

  _onDoublePress(pressEvent) {
    const relativeX = parseFloat(pressEvent.locationX / this.state.width);
    if (Number.isNaN(relativeX)) return;
    console.log(relativeX);
    if (relativeX > 1 / 3 && relativeX < 2 / 3) {
      this.methods.toggleFullscreen();
    } else {
      const isForward = relativeX > 2 / 3;
      this.skipTime(isForward);
      this.doublePressAnimation(isForward);
    }
  }

  skipTime(isForward) {
    let time =
      this.state.currentTime +
      (isForward ? +this.props.skipTime : -this.props.skipTime);

    time = parseFloat(Math.max(time, 0));

    let state = this.state;
    if (time >= state.duration && !state.loading) {
      state.paused = true;
      this.events.onEnd();
    } else {
      this.seekTo(time);
      this.setControlTimeout();
      state.paused = state.originallyPaused;
      state.seeking = false;
    }
    this.setState(state);
  }

  _onComponentLayout(layoutEvent) {
    // console.log('layout event', layoutEvent.nativeEvent.layout);
    let state = this.state;
    state.width = layoutEvent.nativeEvent.layout.width;
    this.setState(state);
  }

  /**
    | -------------------------------------------------------
    | Methods
    | -------------------------------------------------------
    |
    | These are all of our functions that interact with
    | various parts of the class. Anything from
    | calculating time remaining in a video
    | to handling control operations.
    |
    */

  /**
   * Set a timeout when the controls are shown
   * that hides them after a length of time.
   * Default is 15s
   */
  setControlTimeout() {
    this.player.controlTimeout = setTimeout(() => {
      this._hideControls();
    }, this.player.controlTimeoutDelay);
  }

  /**
   * Clear the hide controls timeout.
   */
  clearControlTimeout() {
    clearTimeout(this.player.controlTimeout);
  }

  /**
   * Reset the timer completely
   */
  resetControlTimeout() {
    this.clearControlTimeout();
    this.setControlTimeout();
  }

  /**
   * Animation to hide controls. We fade the
   * display to 0 then move them off the
   * screen so they're not interactable
   */
  hideControlAnimation() {
    Animated.parallel([
      Animated.timing(this.animations.topControl.opacity, {
        toValue: 0,
        duration: this.props.controlAnimationTiming,
        useNativeDriver: false,
      }),
      Animated.timing(this.animations.topControl.marginTop, {
        toValue: -100,
        duration: this.props.controlAnimationTiming,
        useNativeDriver: false,
      }),
      Animated.timing(this.animations.bottomControl.opacity, {
        toValue: 0,
        duration: this.props.controlAnimationTiming,
        useNativeDriver: false,
      }),
      Animated.timing(this.animations.bottomControl.marginBottom, {
        toValue: -100,
        duration: this.props.controlAnimationTiming,
        useNativeDriver: false,
      }),
    ]).start();
  }

  /**
   * Animation to show controls...opposite of
   * above...move onto the screen and then
   * fade in.
   */
  showControlAnimation() {
    Animated.parallel([
      Animated.timing(this.animations.topControl.opacity, {
        toValue: 1,
        useNativeDriver: false,
        duration: this.props.controlAnimationTiming,
      }),
      Animated.timing(this.animations.topControl.marginTop, {
        toValue: 0,
        useNativeDriver: false,
        duration: this.props.controlAnimationTiming,
      }),
      Animated.timing(this.animations.bottomControl.opacity, {
        toValue: 1,
        useNativeDriver: false,
        duration: this.props.controlAnimationTiming,
      }),
      Animated.timing(this.animations.bottomControl.marginBottom, {
        toValue: 0,
        useNativeDriver: false,
        duration: this.props.controlAnimationTiming,
      }),
    ]).start();
  }

  /**
   * Loop animation to spin loader icon. If not loading then stop loop.
   */
  loadAnimation() {
    if (this.state.loading) {
      Animated.sequence([
        Animated.timing(this.animations.loader.rotate, {
          toValue: this.animations.loader.MAX_VALUE,
          duration: 1500,
          easing: Easing.linear,
          useNativeDriver: false,
        }),
        Animated.timing(this.animations.loader.rotate, {
          toValue: 0,
          duration: 0,
          easing: Easing.linear,
          useNativeDriver: false,
        }),
      ]).start(this.loadAnimation.bind(this));
    }
  }

  /**
   * Opacity animation when a double press happens (left or right)
   */
  doublePressAnimation(right) {
    const animation = right
      ? this.animations.rightDoublePress
      : this.animations.leftDoublePress;

    const duration = 700 / 2;
    const easing = Easing.linear;

    const opacityOnIn = {toValue: 1, easing, duration, useNativeDriver: false};
    const opacityOffIn = {toValue: 0, easing, duration, useNativeDriver: false};
    Animated.sequence([
      Animated.timing(animation.opacity, opacityOnIn),
      Animated.timing(animation.opacity, opacityOffIn),
    ]).start();
  }

  /**
   * Shows both backward and forward buttons then hides them
   */
  flashBackwardForwardButtons() {
    const skipBackward = this.animations.leftDoublePress;
    const skipForward = this.animations.rightDoublePress;

    const opacityOnIn = {
      toValue: 1,
      easing: Easing.linear,
      duration: 350,
      useNativeDriver: false,
    };
    const opacityOffIn = {
      toValue: 0,
      easing: Easing.ease,
      duration: 1200,
      useNativeDriver: false,
    };

    Animated.sequence([
      Animated.parallel([
        Animated.timing(skipBackward.opacity, opacityOnIn),
        Animated.timing(skipForward.opacity, opacityOnIn),
      ]),
      Animated.parallel([
        Animated.timing(skipBackward.opacity, opacityOffIn),
        Animated.timing(skipForward.opacity, opacityOffIn),
      ]),
    ]).start();
  }

  /**
   * Function to hide the controls. Sets our
   * state then calls the animation.
   */
  _hideControls() {
    if (this.mounted) {
      let state = this.state;
      state.showControls = false;
      this.hideControlAnimation();
      typeof this.events.onHideControls === 'function' &&
        this.events.onHideControls();

      this.setState(state);
    }
  }

  /**
   * Function to toggle controls based on
   * current state.
   */
  _toggleControls() {
    let state = this.state;
    state.showControls = !state.showControls;

    if (state.showControls) {
      this.showControlAnimation();
      this.setControlTimeout();
      typeof this.events.onShowControls === 'function' &&
        this.events.onShowControls();
    } else {
      this.hideControlAnimation();
      this.clearControlTimeout();
      typeof this.events.onHideControls === 'function' &&
        this.events.onHideControls();
    }

    this.setState(state);
  }

  /**
   * Toggle fullscreen changes resizeMode on
   * the <Video> component then updates the
   * isFullscreen state.
   */
  _toggleFullscreen() {
    let state = this.state;

    state.isFullscreen = !state.isFullscreen;

    if (this.props.toggleResizeModeOnFullscreen) {
      state.resizeMode = state.isFullscreen === true ? 'cover' : 'contain';
    }

    if (state.isFullscreen) {
      typeof this.events.onEnterFullscreen === 'function' &&
        this.events.onEnterFullscreen();
    } else {
      typeof this.events.onExitFullscreen === 'function' &&
        this.events.onExitFullscreen();
    }

    this.setState(state);
  }

  /**
   * Toggle playing state on <Video> component
   */
  _togglePlayPause() {
    let state = this.state;
    state.paused = !state.paused;

    if (state.paused) {
      typeof this.events.onPause === 'function' && this.events.onPause();
    } else {
      typeof this.events.onPlay === 'function' && this.events.onPlay();
    }

    this.setState(state);
  }

  /**
   * Toggle between showing time remaining or
   * video duration in the timer control
   */
  _toggleTimer() {
    let state = this.state;
    state.showTimeRemaining = !state.showTimeRemaining;
    this.setState(state);
  }

  _toggleRate() {
    const rates = this.props.rates;
    const indexOfCurrentRate = rates.indexOf(this.state.rate);
    if (indexOfCurrentRate < 0) return;
    const nextIndex = (indexOfCurrentRate + 1) % rates.length;
    const rate = rates[nextIndex];

    typeof this.events.onRateChange === 'function' &&
      this.events.onRateChange(rate);

    this.setState({rate});
  }

  _toggleVideoResolution() {
    const {videoSources} = this.props;
    const indexOfCurrentResolution = videoSources.findIndex(
      vs => vs.videoResolution === this.state.videoResolution,
    );
    if (this.state.loading || indexOfCurrentResolution < 0) return;

    const nextIndex = (indexOfCurrentResolution + 1) % videoSources.length;
    const {videoResolution, uri} = videoSources[nextIndex];

    // console.log('toggleVideoRes new uri', uri.split('mp4')[0]);
    // console.log('toggleVideoRes prev uri', this.state.source.uri.split('mp4')[0]);
    // console.log('toggleVideRes source', {uri});

    let state = this.state;
    state.videoResolution = videoResolution;
    state.source = {uri};
    state.changingVideoResolution = true;
    this.setState(state);

    if (typeof this.events.onVideoResolutionChange === 'function') {
      this.events.onVideoResolutionChange(videoResolution);
    }
  }

  /**
   * The default 'onBack' function pops the navigator
   * and as such the video player requires a
   * navigator prop by default.
   */
  _onBack() {
    if (this.props.navigator && this.props.navigator.pop) {
      this.props.navigator.pop();
    } else {
      console.warn(
        'Warning: _onBack requires navigator property to function. Either modify the onBack prop or pass a navigator prop',
      );
    }
  }

  /**
   * If it's casting the current time is passed by the props
   * otherwise use the internal one
   */
  getCurrentTime() {
    return this.props.isCasting
      ? this.props.elapsedTime ?? 0
      : this.state.currentTime;
  }

  /**
   * Calculate the time to show in the timer area
   * based on if they want to see time remaining
   * or duration. Formatted to look as 00:00.
   */
  calculateTime() {
    if (this.state.showTimeRemaining) {
      const time = this.state.duration - this.getCurrentTime();
      return `-${this.formatTime(time)}`;
    }

    return this.formatTime(this.getCurrentTime());
  }

  /**
   * Format a time string as mm:ss
   *
   * @param {int} time time in milliseconds
   * @return {string} formatted time string in mm:ss format
   */
  formatTime(time = 0) {
    const symbol = this.state.showRemainingTime ? '-' : '';
    time = Math.min(Math.max(time, 0), this.state.duration);

    if (!this.state.showHours) {
      const formattedMinutes = padStart(Math.floor(time / 60).toFixed(0), 2, 0);
      const formattedSeconds = padStart(Math.floor(time % 60).toFixed(0), 2, 0);

      return `${symbol}${formattedMinutes}:${formattedSeconds}`;
    }

    const formattedHours = padStart(Math.floor(time / 3600).toFixed(0), 2, 0);
    const formattedMinutes = padStart(
      (Math.floor(time / 60) % 60).toFixed(0),
      2,
      0,
    );
    const formattedSeconds = padStart(Math.floor(time % 60).toFixed(0), 2, 0);

    return `${symbol}${formattedHours}:${formattedMinutes}:${formattedSeconds}`;
  }

  /**
   * Set the position of the seekbar's components
   * (both fill and handle) according to the
   * position supplied.
   *
   * @param {float} position position in px of seeker handle}
   */
  setSeekerPosition(position = 0) {
    let state = this.state;
    position = this.constrainToSeekerMinMax(position);

    state.seekerFillWidth = position;
    state.seekerPosition = position;

    if (!state.seeking) {
      state.seekerOffset = position;
    }

    this.setState(state);
  }

  /**
   * Constrain the location of the seeker to the
   * min/max value based on how big the
   * seeker is.
   *
   * @param {float} val position of seeker handle in px
   * @return {float} constrained position of seeker handle in px
   */
  constrainToSeekerMinMax(val = 0) {
    if (val <= 0) {
      return 0;
    } else if (val >= this.player.seekerWidth) {
      return this.player.seekerWidth;
    }
    return val;
  }

  /**
   * Calculate the position that the seeker should be
   * at along its track.
   *
   * @return {float} position of seeker handle in px based on currentTime
   */
  calculateSeekerPosition() {
    const percent = this.getCurrentTime() / this.state.duration;
    return this.player.seekerWidth * percent;
  }

  /**
   * Return the time that the video should be at
   * based on where the seeker handle is.
   *
   * @return {float} time in ms based on seekerPosition.
   */
  calculateTimeFromSeekerPosition() {
    const percent = this.state.seekerPosition / this.player.seekerWidth;
    return this.state.duration * percent;
  }

  /**
   * Seek to a time in the video.
   *
   * @param {float} time time to seek to in ms
   */
  seekTo(time = 0) {
    if (typeof this.events.onSeekStarted === 'function') {
      this.events.onSeekStarted(this.state.currentTime, time);
    }

    if (this.props.isCasting) return;
    let state = this.state;
    state.currentTime = time;
    this.player.ref.seek(time);
    this.setState(state);
  }

  /**
   * Set the position of the volume slider
   *
   * @param {float} position position of the volume handle in px
   */
  setVolumePosition(position = 0) {
    let state = this.state;
    position = this.constrainToVolumeMinMax(position);
    state.volumePosition = position + this.player.iconOffset;
    state.volumeFillWidth = position;

    state.volumeTrackWidth = this.player.volumeWidth - state.volumeFillWidth;

    if (state.volumeFillWidth < 0) {
      state.volumeFillWidth = 0;
    }

    if (state.volumeTrackWidth > 150) {
      state.volumeTrackWidth = 150;
    }

    this.setState(state);
  }

  /**
   * Constrain the volume bar to the min/max of
   * its track's width.
   *
   * @param {float} val position of the volume handle in px
   * @return {float} constrained position of the volume handle in px
   */
  constrainToVolumeMinMax(val = 0) {
    if (val <= 0) {
      return 0;
    } else if (val >= this.player.volumeWidth + 9) {
      return this.player.volumeWidth + 9;
    }
    return val;
  }

  /**
   * Get the volume based on the position of the
   * volume object.
   *
   * @return {float} volume level based on volume handle position
   */
  calculateVolumeFromVolumePosition() {
    return this.state.volumePosition / this.player.volumeWidth;
  }

  /**
   * Get the position of the volume handle based
   * on the volume
   *
   * @return {float} volume handle position in px based on volume
   */
  calculateVolumePositionFromVolume() {
    return this.player.volumeWidth * this.state.volume;
  }

  /**
    | -------------------------------------------------------
    | React Component functions
    | -------------------------------------------------------
    |
    | Here we're initializing our listeners and getting
    | the component ready using the built-in React
    | Component methods
    |
    */

  /**
   * Before mounting, init our seekbar and volume bar
   * pan responders.
   */
  UNSAFE_componentWillMount() {
    this.initSeekPanResponder();
    this.initVolumePanResponder();
  }

  /**
   * To allow basic playback management from the outside
   * we have to handle possible props changes to state changes
   */
  UNSAFE_componentWillReceiveProps(nextProps) {
    // console.log('video controls receives new props:', this.props, nextProps);
    const {videoSources, paused, videoStyle, style, rate} = nextProps;
    let state = this.state;

    state.paused = paused;
    state.rate = rate;

    if (state.videoSources !== videoSources) {
      if (!state.loading) {
        console.log('loading new sources');
        const {uri, videoResolution} =
          videoSources.find(
            vs => vs.videoResolution === state.videoResolution,
          ) ?? {};
        if (!uri || !videoResolution) {
          state.source = {uri: videoSources[0].uri};
          state.videoResolution = videoSources[0].videoResolution;
        } else {
          state.source = {uri};
          state.videoResolution = videoResolution;
        }
        state.videoSources = videoSources;

        //Android MediaPlayer fix for rate bug after source change
        if (Platform.OS === 'android') {
          state.resetRate = true;
        }
      } else {
        console.log('not changing source because is loading');
      }
    }

    this.styles.videoStyle = videoStyle;
    this.styles.containerStyle = style;

    this.setState(state);
  }

  /**
   * Upon mounting, calculate the position of the volume
   * bar based on the volume property supplied to it.
   */
  componentDidMount() {
    const position = this.calculateVolumePositionFromVolume();
    let state = this.state;
    this.setVolumePosition(position);
    state.volumeOffset = position;
    this.mounted = true;

    this.setState(state);
  }

  /**
   * When the component is about to unmount kill the
   * timeout less it fire in the prev/next scene
   */
  componentWillUnmount() {
    this.mounted = false;
    this.clearControlTimeout();
  }

  /**
   * Get our seekbar responder going
   */
  initSeekPanResponder() {
    this.player.seekPanResponder = PanResponder.create({
      // Ask to be the responder.
      onStartShouldSetPanResponder: (evt, gestureState) => true,
      onMoveShouldSetPanResponder: (evt, gestureState) => true,

      /**
       * When we start the pan tell the machine that we're
       * seeking. This stops it from updating the seekbar
       * position in the onProgress listener.
       */
      onPanResponderGrant: (evt, gestureState) => {
        let state = this.state;
        this.clearControlTimeout();
        const position = evt.nativeEvent.locationX;
        this.setSeekerPosition(position);
        state.seeking = true;
        state.originallyPaused = state.paused;
        state.scrubbing = false;
        if (this.player.scrubbingTimeStep > 0) {
          state.paused = true;
        }
        this.setState(state);
      },

      /**
       * When panning, update the seekbar position, duh.
       */
      onPanResponderMove: (evt, gestureState) => {
        const position = this.state.seekerOffset + gestureState.dx;
        this.setSeekerPosition(position);
        let state = this.state;

        if (
          this.player.scrubbingTimeStep > 0 &&
          !state.loading &&
          !state.scrubbing
        ) {
          const time = this.calculateTimeFromSeekerPosition();
          const timeDifference = Math.abs(state.currentTime - time) * 1000;

          if (
            time < state.duration &&
            timeDifference >= this.player.scrubbingTimeStep
          ) {
            state.scrubbing = true;

            this.setState(state);
            if (typeof this.events.onSeekStarted === 'function') {
              this.events.onSeekStarted(this.state.currentTime, time);
            }
            setTimeout(() => {
              this.player.ref.seek(time, this.player.scrubbingTimeStep);
            }, 1);
          }
        }
      },

      /**
       * On release we update the time and seek to it in the video.
       * If you seek to the end of the video we fire the
       * onEnd callback
       */
      onPanResponderRelease: (evt, gestureState) => {
        const time = this.calculateTimeFromSeekerPosition();
        let state = this.state;
        if (time >= state.duration && !state.loading) {
          state.paused = true;
          this.events.onEnd();
        } else if (state.scrubbing) {
          state.seeking = false;
        } else {
          this.seekTo(time);
          this.setControlTimeout();
          state.paused = state.originallyPaused;
          state.seeking = false;
        }
        this.setState(state);
      },
    });
  }

  /**
   * Initialize the volume pan responder.
   */
  initVolumePanResponder() {
    this.player.volumePanResponder = PanResponder.create({
      onStartShouldSetPanResponder: (evt, gestureState) => true,
      onMoveShouldSetPanResponder: (evt, gestureState) => true,
      onPanResponderGrant: (evt, gestureState) => {
        this.clearControlTimeout();
      },

      /**
       * Update the volume as we change the position.
       * If we go to 0 then turn on the mute prop
       * to avoid that weird static-y sound.
       */
      onPanResponderMove: (evt, gestureState) => {
        let state = this.state;
        const position = this.state.volumeOffset + gestureState.dx;

        this.setVolumePosition(position);
        state.volume = this.calculateVolumeFromVolumePosition();

        if (state.volume <= 0) {
          state.muted = true;
        } else {
          state.muted = false;
        }

        this.setState(state);
      },

      /**
       * Update the offset...
       */
      onPanResponderRelease: (evt, gestureState) => {
        let state = this.state;
        state.volumeOffset = state.volumePosition;
        this.setControlTimeout();
        this.setState(state);
      },
    });
  }

  /**
    | -------------------------------------------------------
    | Rendering
    | -------------------------------------------------------
    |
    | This section contains all of our render methods.
    | In addition to the typical React render func
    | we also have all the render methods for
    | the controls.
    |
    */

  /**
   * Standard render control function that handles
   * everything except the sliders. Adds a
   * consistent <TouchableHighlight>
   * wrapper and styling.
   */
  renderControl(children, callback, style = {}, disabled = false) {
    return (
      <TouchableHighlight
        underlayColor="transparent"
        disabled={disabled}
        activeOpacity={0.3}
        onPress={() => {
          this.resetControlTimeout();
          callback();
        }}
        style={[styles.controls.control, style]}>
        {children}
      </TouchableHighlight>
    );
  }

  /**
   * Renders an empty control, used to disable a control without breaking the view layout.
   */
  renderNullControl() {
    return <View style={[styles.controls.control]} />;
  }

  /**
   * Groups the top bar controls together in an animated
   * view and spaces them out.
   */
  renderTopControls() {
    const backControl = this.props.disableBack
      ? this.renderNullControl()
      : this.renderBack();
    const volumeControl = this.props.disableVolume
      ? this.renderNullControl()
      : this.renderVolume();
    const googleCastControl = !this.props.googleCastButton
      ? this.renderNullControl()
      : this.props.googleCastButton;
    const fullscreenControl = this.props.disableFullscreen
      ? this.renderNullControl()
      : this.renderFullscreen();

    return (
      <Animated.View
        style={[
          styles.controls.top,
          {
            opacity: this.animations.topControl.opacity,
            marginTop: this.animations.topControl.marginTop,
          },
        ]}>
        <ImageBackground
          source={require('./assets/img/top-vignette.png')}
          style={[styles.controls.column]}
          imageStyle={[styles.controls.vignette]}>
          <SafeAreaView style={styles.controls.topControlGroup}>
            {backControl}
            <View style={styles.controls.pullRight}>
              {googleCastControl}
              {volumeControl}
              {fullscreenControl}
            </View>
          </SafeAreaView>
        </ImageBackground>
      </Animated.View>
    );
  }

  /**
   * Back button control
   */
  renderBack() {
    return this.renderControl(
      <Image
        source={require('./assets/img/back.png')}
        style={styles.controls.back}
      />,
      this.events.onBack,
      styles.controls.back,
    );
  }

  /**
   * Render the volume slider and attach the pan handlers
   */
  renderVolume() {
    return (
      <View style={styles.volume.container}>
        <View
          style={[styles.volume.fill, {width: this.state.volumeFillWidth}]}
        />
        <View
          style={[styles.volume.track, {width: this.state.volumeTrackWidth}]}
        />
        <View
          style={[styles.volume.handle, {left: this.state.volumePosition}]}
          {...this.player.volumePanResponder.panHandlers}>
          <Image
            style={styles.volume.icon}
            source={require('./assets/img/volume.png')}
          />
        </View>
      </View>
    );
  }

  /**
   * Render fullscreen toggle and set icon based on the fullscreen state.
   */
  renderFullscreen() {
    let source =
      this.state.isFullscreen === true
        ? require('./assets/img/shrink.png')
        : require('./assets/img/expand.png');
    return this.renderControl(
      <Image source={source} />,
      this.methods.toggleFullscreen,
      styles.controls.fullscreen,
    );
  }

  renderRateControl() {
    const rateToString = Number(this.state.rate.toFixed(2)) + 'x';
    return this.renderControl(
      <Text style={styles.controls.rateText}>{rateToString}</Text>,
      this.methods.toggleRate,
      styles.controls.rate,
    );
  }

  renderVideoResolution() {
    return this.renderControl(
      <Text style={styles.controls.videoResolutionText}>
        {this.state.videoResolution}
      </Text>,
      !!this.events.onPressResolution ? this.events.onPressResolution : this.methods.toggleVideoResolution,
      styles.controls.videoResolution,
      this.state.loading,
    );
  }

  /**
   * Render bottom control group and wrap it in a holder
   */
  renderBottomControls() {
    const timerControl = this.props.disableTimer
      ? this.renderNullControl()
      : this.renderTimer();
    const seekbarControl = this.props.disableSeekbar
      ? this.renderNullControl()
      : this.renderSeekbar();
    const playPauseControl = this.props.disablePlayPause
      ? this.renderNullControl()
      : this.renderPlayPause();
    const rateControl = this.props.rates
      ? this.renderRateControl()
      : this.renderNullControl();
    const videoResolutionsControl =
      this.props.videoSources?.length > 0
        ? this.renderVideoResolution()
        : this.renderNullControl();

    return (
      <Animated.View
        style={[
          styles.controls.bottom,
          {
            opacity: this.animations.bottomControl.opacity,
            marginBottom: this.animations.bottomControl.marginBottom,
          },
        ]}>
        <ImageBackground
          source={require('./assets/img/bottom-vignette.png')}
          style={[styles.controls.column]}
          imageStyle={[styles.controls.vignette]}>
          {seekbarControl}
          <SafeAreaView
            style={[styles.controls.row, styles.controls.bottomControlGroup]}>
            <SafeAreaView style={[styles.controls.leftBottomControlGroup]}>
              {playPauseControl}
              {rateControl}
              {videoResolutionsControl}
            </SafeAreaView>
            {this.renderTitle()}
            {timerControl}
          </SafeAreaView>
        </ImageBackground>
      </Animated.View>
    );
  }

  /**
   * Render the seekbar and attach its handlers
   */
  renderSeekbar() {
    return (
      <View
        style={styles.seekbar.container}
        collapsable={false}
        {...this.player.seekPanResponder.panHandlers}>
        <View
          style={styles.seekbar.track}
          onLayout={event =>
            (this.player.seekerWidth = event.nativeEvent.layout.width)
          }
          pointerEvents={'none'}>
          <View
            style={[
              styles.seekbar.fill,
              {
                width: this.state.seekerFillWidth,
                backgroundColor: this.props.seekColor || '#FFF',
              },
            ]}
            pointerEvents={'none'}
          />
        </View>
        <View
          style={[styles.seekbar.handle, {left: this.state.seekerPosition}]}
          pointerEvents={'none'}>
          <View
            style={[
              styles.seekbar.circle,
              {backgroundColor: this.props.seekColor || '#FFF'},
            ]}
            pointerEvents={'none'}
          />
        </View>
      </View>
    );
  }

  /**
   * Render the play/pause button and show the respective icon
   */
  renderPlayPause() {
    let source =
      this.state.paused === true
        ? require('./assets/img/play.png')
        : require('./assets/img/pause.png');
    return this.renderControl(
      <Image source={source} />,
      this.methods.togglePlayPause,
      styles.controls.playPause,
    );
  }

  /**
   * Render our title...if supplied.
   */
  renderTitle() {
    if (this.opts.title) {
      return (
        <View style={[styles.controls.control, styles.controls.title]}>
          <Text
            style={[styles.controls.text, styles.controls.titleText]}
            numberOfLines={1}>
            {this.opts.title || ''}
          </Text>
        </View>
      );
    }

    return null;
  }

  /**
   * Show our timer.
   */
  renderTimer() {
    return this.renderControl(
      <Text style={styles.controls.timerText}>{this.calculateTime()}</Text>,
      this.methods.toggleTimer,
      styles.controls.timer,
    );
  }

  /**
   * Show loading icon
   */
  renderLoader() {
    if (this.state.loading) {
      return (
        <View style={styles.loader.container}>
          <Animated.Image
            source={require('./assets/img/loader-icon.png')}
            style={[
              styles.loader.icon,
              {
                transform: [
                  {
                    rotate: this.animations.loader.rotate.interpolate({
                      inputRange: [0, 360],
                      outputRange: ['0deg', '360deg'],
                    }),
                  },
                ],
              },
            ]}
          />
        </View>
      );
    }
    return null;
  }

  /**
   * Show loading icon
   */
  renderCastIcon() {
    if (this.props.isCasting) {
      return (
        <View style={styles.googleCast.container}>
          <Image
            source={require('./assets/img/google-cast.png')}
            style={styles.googleCast.icon}
          />
        </View>
      );
    }
    return null;
  }

  renderSkipIcons() {
    return (
      <View style={styles.skipIcons.container}>
        <Animated.Image
          source={require('./assets/img/angle-double-left-solid.png')}
          style={[
            styles.skipIcons.icon,
            {
              opacity: this.animations.leftDoublePress.opacity,
              tintColor: this.props.skipIconColor || '#FFF',
            },
          ]}
        />
        <Animated.Image
          source={require('./assets/img/angle-double-right-solid.png')}
          style={[
            styles.skipIcons.icon,
            {
              opacity: this.animations.rightDoublePress.opacity,
              tintColor: this.props.skipIconColor || '#FFF',
            },
          ]}
        />
      </View>
    );
  }

  renderError() {
    if (this.state.error) {
      return (
        <View style={styles.error.container}>
          <Image
            source={require('./assets/img/error-icon.png')}
            style={styles.error.icon}
          />
          <Text style={styles.error.text}>Video unavailable</Text>
        </View>
      );
    }
    return null;
  }

  /**
   * Provide all of our options and render the whole component.
   */
  render() {
    return (
      <TouchableWithoutFeedback
        onPress={this.events.onScreenTouch}
        onLayout={this.events.onComponentLayout}
        style={[styles.player.container, this.styles.containerStyle]}>
        <View style={[styles.player.container, this.styles.containerStyle]}>
          <Video
            {...this.props}
            ref={videoPlayer => (this.player.ref = videoPlayer)}
            resizeMode={this.state.resizeMode}
            volume={this.state.volume}
            paused={this.state.paused || this.props.isCasting}
            muted={this.state.muted}
            rate={this.state.resetRate ? 1 : this.state.rate}
            // rate={this.state.rate}
            onLoadStart={this.events.onLoadStart}
            onProgress={this.events.onProgress}
            onError={this.events.onError}
            onLoad={this.events.onLoad}
            onEnd={this.events.onEnd}
            onSeek={this.events.onSeek}
            style={[styles.player.video, this.styles.videoStyle]}
            source={{uri: this.state.source?.uri, headers: this.state.headers}}
          />
          {this.renderSkipIcons()}
          {this.renderError()}
          {this.renderLoader()}
          {this.renderCastIcon()}
          {this.renderTopControls()}
          {this.renderBottomControls()}
        </View>
      </TouchableWithoutFeedback>
    );
  }
}

/**
 * This object houses our styles. There's player
 * specific styles and control specific ones.
 * And then there's volume/seeker styles.
 */
const styles = {
  player: StyleSheet.create({
    container: {
      overflow: 'hidden',
      backgroundColor: '#000',
      flex: 1,
      alignSelf: 'stretch',
      justifyContent: 'space-between',
    },
    video: {
      overflow: 'hidden',
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    },
  }),
  skipIcons: StyleSheet.create({
    container: {
      position: 'absolute',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
      overflow: 'hidden',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    },
    icon: {
      width: 60,
      height: 60,
      // borderWidth: 1,
      borderColor: 'rgba(0, 0, 0, 0.25)',
      borderRadius: 99999,
      marginHorizontal: 50,
      resizeMode: 'center',
      backgroundColor: 'rgba(255, 255, 255, 0.25)',
    },
  }),
  error: StyleSheet.create({
    container: {
      backgroundColor: 'rgba(0,0,0,0.5)',
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      justifyContent: 'center',
      alignItems: 'center',
    },
    icon: {
      marginBottom: 16,
    },
    text: {
      backgroundColor: 'transparent',
      color: '#f27474',
    },
  }),
  loader: StyleSheet.create({
    container: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
  }),
  googleCast: StyleSheet.create({
    container: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'black',
    },
    icon: {
      tintColor: 'white',
      width: 50,
      height: 50,
    },
  }),
  controls: StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: null,
      width: null,
    },
    column: {
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: null,
      width: null,
    },
    vignette: {
      resizeMode: 'stretch',
    },
    control: {
      padding: 16,
    },
    text: {
      backgroundColor: 'transparent',
      color: '#FFF',
      fontSize: 14,
      textAlign: 'center',
    },
    pullRight: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    top: {
      flex: 1,
      alignItems: 'stretch',
      justifyContent: 'flex-start',
    },
    bottom: {
      alignItems: 'stretch',
      flex: 2,
      justifyContent: 'flex-end',
    },
    topControlGroup: {
      alignSelf: 'stretch',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexDirection: 'row',
      width: null,
      margin: 12,
      marginBottom: 18,
    },
    bottomControlGroup: {
      alignSelf: 'stretch',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginLeft: 12,
      marginRight: 12,
      marginBottom: 0,
    },
    leftBottomControlGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'stretch',
      justifyContent: 'space-between',
    },
    volume: {
      flexDirection: 'row',
    },
    fullscreen: {
      flexDirection: 'row',
    },
    playPause: {
      position: 'relative',
      width: 45,
      zIndex: 0,
    },
    title: {
      alignItems: 'center',
      flex: 0.6,
      flexDirection: 'column',
      padding: 0,
    },
    titleText: {
      textAlign: 'center',
    },
    timer: {
      width: 100,
    },
    timerText: {
      backgroundColor: 'transparent',
      color: '#FFF',
      fontSize: 15,
      textAlign: 'right',
    },
    rate: {
      width: 70,
    },
    rateText: {
      textAlign: 'center',
      backgroundColor: 'transparent',
      color: '#FFF',
      fontSize: 15,
    },
    videoResolution: {
      width: 77,
    },
    videoResolutionText: {
      textAlign: 'center',
      backgroundColor: 'transparent',
      color: '#FFF',
      fontSize: 15,
    },
  }),
  volume: StyleSheet.create({
    container: {
      alignItems: 'center',
      justifyContent: 'flex-start',
      flexDirection: 'row',
      height: 1,
      marginLeft: 20,
      marginRight: 20,
      width: 150,
    },
    track: {
      backgroundColor: '#333',
      height: 1,
      marginLeft: 7,
    },
    fill: {
      backgroundColor: '#FFF',
      height: 1,
    },
    handle: {
      position: 'absolute',
      marginTop: -24,
      marginLeft: -24,
      padding: 16,
    },
    icon: {
      marginLeft: 7,
    },
  }),
  seekbar: StyleSheet.create({
    container: {
      alignSelf: 'stretch',
      height: 28,
      marginLeft: 20,
      marginRight: 20,
    },
    track: {
      backgroundColor: '#333',
      height: 3,
      position: 'relative',
      top: 14,
      width: '100%',
    },
    fill: {
      backgroundColor: '#ff0f0f',
      height: 3,
      width: '100%',
    },
    handle: {
      position: 'absolute',
      marginLeft: -7,
      height: 28,
      width: 28,
    },
    circle: {
      borderRadius: 12,
      position: 'relative',
      top: 9,
      left: 8,
      height: 13,
      width: 13,
    },
  }),
};
