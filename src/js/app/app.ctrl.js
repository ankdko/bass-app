(function() {
  'use strict';

  angular
    .module('bd.app')
    .controller('AppController', AppController)
    .value('context', new AudioContext())
    .value('workspace', {})
    .directive('ngRightClick', function($parse) {
      return function(scope, element, attrs) {
        var fn = $parse(attrs.ngRightClick);
        element.bind('contextmenu', function(event) {
          scope.$apply(function() {
            event.preventDefault();
            fn(scope, {$event:event});
          });
        });
      };
    });

  function AppController($scope, $timeout, context, workspace, audioPlayer, audioVisualiser, projectManager, Drums) {

    $scope.ui = {
      selectTrack: angular.noop
    };
    $scope.player = {
      playing: false,
      play: angular.noop,
      input: audioPlayer.input,
      countdown: false,
      loop: true,
      speed: 100,
      playbackRange: {
        start: 1,
        end: 1
      },
      playbackRangeChanged: angular.noop,
      graphEnabled: false,
      visibleBeatsOnly: false
    };
    // initial volume for input after un-mute
    audioPlayer.input._volume = 0.75;

    $scope.bass = {
      playingStyles: [
        {
          name: 'finger',
          label: 'Finger'
        }, {
          name: 'slap',
          label: 'Slap'
        }, {
          name: 'pop',
          label: 'Pop'
        }, {
          name: 'pick',
          label: 'Pick'
        }, {
          name: 'tap',
          label: 'Tap'
        }, {
          name: 'hammer',
          label: 'Hammer-On'
        }, {
          name: 'pull',
          label: 'Pull-Off'
        }, {
          name: 'ring',
          label: 'Let ring'
        }
      ],
      settings: {
        label: 'name-and-fret',
        colors: true
      }
    };

    $scope.projectManager = projectManager;
    $scope.project = projectManager.createProject([
      {
        type: 'bass',
        name: 'Bassline',
        strings: 'EADG',
        tuning: [0, 0, 0, 0]
      }, /*{
        type: 'bass',
        name: 'Melody',
        strings: 'BEADG',
        tuning: [0, 0, 0, 0, 0]
      }, */{
        type: 'drums',
        kit: 'Standard',
        name: 'Standard'
      }, {
        type: 'drums',
        kit: 'Bongo',
        name: 'Bongo'
      }
    ]);

    $scope.section = projectManager.createSection({
      timeSignature: {
        top: 4,
        bottom: 4
      },
      bpm: 80,
      length: 3,
      beatsPerSlide: 1,
      beatsPerView: 10,
      animationDuration: 300
    });

    angular.extend(workspace, {
      selectedSectionIndex: -1,
      section: $scope.section,
      data: null
    });
    $scope.workspace = workspace;

    $scope.barLabels = {
      3: ['trip', 'let'],
      4: ['e', 'and', 'a']
    };

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
        audioVisualiser.connect(audioPlayer.bass.audio);
      } else {
        if (!input.source) {
          var gotStream = function(stream) {
            input.stream = stream;
            // Create an AudioNode from the stream.
            input.source = context.createMediaStreamSource(stream);
            input.source.connect(input.audio);
            audioVisualiser.connect(input.audio);
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


    // Load standard drums kit sounds
    var resources = Drums.Standard.map(function(drum) {
      return drum.filename;
    });
    audioPlayer.bufferLoader.loadResources(resources);
    // Load bongo drums kit sounds
    resources = Drums.Bongo.map(function(drum) {
      return drum.filename;
    });
    audioPlayer.bufferLoader.loadResources(resources);

    window.workspace = workspace;
    window.pm = projectManager;

    // Prevent default context menu
    window.oncontextmenu = function() {
      return false;
    }

  }
})();
