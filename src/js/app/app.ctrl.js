(function() {
  'use strict';

  angular
    .module('bd.app')
    .controller('AppController', AppController)
    .value('context', new AudioContext())
    .value('workspace', {})
    .value('settings', {
      fretboard: {
        size: 19
      }
    })
    .constant('Note', {
      Whole: {
        label: 'WHOLE',
        symbol: 'whole-note',
        value: 1
      },
      Half: {
        label: 'HALF',
        symbol: 'half-note',
        value: 2
      },
      Quarter: {
        label: 'QUARTER',
        symbol: 'quarter-note',
        value: 4
      },
      Eighth: {
        label: 'EIGHTH',
        symbol: 'eighth-note',
        value: 8
      },
      Sixteenth: {
        label: 'SIXTEENTH',
        symbol: 'sixteenth-note',
        value: 16
      },
      ThirtySecond: {
        label: 'THIRTYSECOND',
        symbol: 'thirty-second-note',
        value: 32
      }
    })
    .run(function($mdDialog) {
      if(/Android|webOS|iPhone|iPad|iPod|BlackBerry/i.test(navigator.userAgent)) {
        function adjustScale() {
          var ww = Math.min(window.innerWidth, window.screen.width); //get proper width
          // ww = window.screen.width;
          var mw = 1048; // required min width
          var ratio =  ww / mw;
          if( ww < mw) {
            var metaEl = document.head.querySelector('meta[name="viewport"]');
            metaEl.setAttribute('content', 'initial-scale=' + ratio + ', maximum-scale=' + 1 + ', minimum-scale=' + ratio + ', width=' + ww);
          }
        }
        window.addEventListener("orientationchange", adjustScale);
        window.addEventListener("resize", function() {
          document.body.style.minHeight = window.innerHeight+'px';
        })
        setTimeout(adjustScale, 500);
      }

      if (!window.chrome) {
        var alert = $mdDialog.alert()
        .title('Warning')
        .textContent(
          'It is highly recommended to use Blink/Webkit based browser (Chrome, Chromium, Opera). '+
          'Application may not work properly in other browsers.'
        )
        .ok('Close');

        $mdDialog.show(alert);
      }
    })
    .directive('prettyScrollbar', prettyScrollbar)
    .config(function($mdThemingProvider) {
      $mdThemingProvider.theme('default')
        .primaryPalette('blue')
        .accentPalette('blue-grey');
    })

  function prettyScrollbar() {
    return {
      scope: false,
      link: function(scope, iElem, iAttrs, ctrl) {
        if (window.SimpleScrollbar && SimpleScrollbar.width > 0) {
          SimpleScrollbar.initEl(iElem[0], iAttrs.glScrollbar);
        } else {
          iElem.css('overflow', 'auto');
        }
      }
    }
  }

  function AppController($scope, $q, $timeout, $translate, $mdUtil, $mdToast, $mdDialog, $location, context,
      settings, workspace, audioPlayer, audioVisualiser, projectManager, Drums, Note,
      dataUrl, localSoundsUrl, soundsUrl) {
    $scope.Note = Note;
    $scope.settings = settings;

    $scope.language = 'en';
    $scope.setLanguage = function(code) {
      $scope.language = code;
      $translate.use(code);
      localStorage.setItem('preferences.lang', code);
    };
    var lang = localStorage.getItem('preferences.lang');
    if (lang) {
      $scope.setLanguage(lang);
    }

    $scope.ui = {
      selectTrack: angular.noop,
      playlist: {},
      zoom: 100,
      scale: 1
    };
    $scope.setAppZoom = function(zoom) {
      document.body.parentElement.setAttribute('zoom', zoom);
      document.body.setAttribute('zoom', zoom);
      $scope.ui.scale = 100/zoom;
      $scope.ui.zoom = zoom;
      window.scale = 100/zoom;
      localStorage.setItem('preferences.zoom', zoom);
    };
    $scope.setAppZoom(localStorage.getItem('preferences.zoom') || 100);

    $scope.player = {
      mode: $location.hash()? 1 : 0,
      playing: false,
      play: angular.noop,
      input: audioPlayer.input,
      countdown: false,
      loop: true,
      speed: 100,
      playbackRange: {
        start: 1,
        end: 1,
        max: 1
      },
      playbackRangeChanged: angular.noop,
      progress: {
        max: 0,
        value: 0
      },
      setProgress: angular.noop,
      graphEnabled: false,
      visibleBeatsOnly: false,
      playlist: []
    };
    $scope.playlistLabel = function(value) {
      var label = $scope.player.playlist[value-1];
      return label;
      // return '({0}) {1}'.format(value, label);
    };

    function handleSoundSampleError() {
      audioPlayer.bufferLoader.onError = function() {
        $mdToast.show(
          $mdToast.simple()
            .toastClass('error')
            .textContent('Failed to load sound sample!')
            .position('bottom center')
        );
      };
    }
    // check local sounds server and switch to public server when unavailable
    audioPlayer.bufferLoader = new BufferLoader(context, localSoundsUrl);
    audioPlayer.bufferLoader.loadResource(
      'sounds/drums/drumstick',
      handleSoundSampleError,
      function() {
        audioPlayer.bufferLoader.serverUrl = soundsUrl;
        handleSoundSampleError()
      }
    );

    audioPlayer.fetchResourcesWithProgress = function(resources) {
      var task = $q.defer();
      $scope.player.loading = true;
      this.fetchResources(resources)
        .then(
          function() {
            // $scope.player.loading = false;
            task.resolve();
          },
          task.reject)
        .finally(function() {
          $scope.player.loading = false;
        });
      return task.promise;
    }
    // initial volume for input after un-mute
    audioPlayer.input._volume = 0.75;

    $scope.bass = {
      playingStyles: [
        {
          name: 'finger',
          label: 'FINGER'
        }, {
          name: 'slap',
          label: 'SLAP'
        }, {
          name: 'pop',
          label: 'POP'
        }, {
          name: 'pick',
          label: 'PICK'
        }, {
          name: 'tap',
          label: 'TAP'
        }, {
          name: 'hammer',
          label: 'HAMMER_ON'
        }, {
          name: 'pull',
          label: 'PULL_OFF'
        }, {
          name: 'ring',
          label: 'LET_RING'
        }
      ],
      settings: {
        label: 'name-and-fret',
        colors: true
      }
    };

    $scope.projectManager = projectManager;
    $scope.workspace = workspace;

    $scope.barLabels = {
      3: ['trip', 'let'],
      4: ['e', 'and', 'a']
    };

    Object.defineProperty(Note, 'map', {value: 'static', writable: true});
    Note.map = {};
    for (var key in Note) {
      var note = Note[key];
      Note.map[note.value] = note.symbol;
    }
    $scope.Note = Note;

    $scope.toggleVolumeMute = function(instrument) {
      if (!instrument.muted) {
        instrument._volume = instrument.audio.gain.value;
        // zero gain value would cause invalid drawing of audio signal
        instrument.audio.gain.value = 0.0001;
      } else {
        instrument.audio.gain.value = instrument._volume || instrument.audio.gain.value;
      }
      instrument.muted = !instrument.muted;
    };

    $scope.toggleInputMute = function(input) {
      $scope.toggleVolumeMute(input);
      if (input.muted) {
        console.log('mute microphone');
        // input.stream.removeTrack(input.stream.getAudioTracks()[0]);
        // input.source.disconnect();
        // audioVisualiser.deactivate();
        // audioVisualiser.activate(workspace.track.audio);
      } else {
        if (!input.source) {
          var gotStream = function(stream) {
            input.stream = stream;
            // Create an AudioNode from the stream.
            input.source = context.createMediaStreamSource(stream);
            input.source.connect(input.audio);
            audioVisualiser.activate(input.audio);
            input.audio.connect(context.destination);
          }

          var error = function() {
            alert('Stream generation failed.');
          }

          navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia;
          navigator.getUserMedia({ audio: true }, gotStream, error);
        } else {
          // input.source.connect(input.audio);
          // audioVisualiser.setInputSource(context, input.audio);
        }
      }
    };

    $scope.addAudioTrack = function(file) {
      var gain = context.createGain();
      gain.connect(context.destination);
      $mdUtil.nextTick(function() {
        $scope.$broadcast('rzSliderForceRender');
      });
      // use saved 'start' value if exists
      var savedStart;
      if ($scope.player.mode === 0 && workspace.section.audioTrackStart) {
        savedStart = workspace.section.audioTrackStart.split(":").map(Number);
      }
      projectManager.project.audioTrack = {
        data: null,
        audio: gain,
        start: savedStart || [0,0,0]
      };
      context.decodeAudioData(file.content, function(buffer) {
        projectManager.project.audioTrack.data = buffer
      });

    };

    $scope.slidesSizeChanged = function() {
      audioVisualiser.updateSize();
    };

    $scope.showHelp = function() {
      $mdDialog.show({
        templateUrl: 'views/help/help.html',
        autoWrap: false,
        clickOutsideToClose: true,
        propagateContainerEvents: true
      })
    };

    $scope.initSliders = function() {
      $scope.$broadcast('rzSliderForceRender');
    };

    // Assign isons for Drums/Percussions
    Drums.Drums.icon = 'drums';
    Drums.Percussions.icon = 'percussions';

    // Stop playback when a tab is going to the background (setTimout will not work
    // properly in background tab)
    document.addEventListener('visibilitychange', function(evt) {
      if ($scope.player.playing && document.visibilityState === 'hidden') {
      $scope.player.playing = false;
        audioPlayer.stop();
        $scope.$apply();
      }
    });

    window.workspace = workspace;
    window.pm = projectManager;
    window.av = audioVisualiser;

    // Prevent default context menu
    window.oncontextmenu = function() {
      return false;
    }

  }
})();
