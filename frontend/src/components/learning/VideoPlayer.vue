<template>
  <div class="video-player" :class="{ 'is-fullscreen': isFullscreen }">
    <div class="video-container" ref="videoContainer">
      <video
        ref="videoElement"
        class="video-element"
        @timeupdate="handleTimeUpdate"
        @loadedmetadata="handleMetadataLoaded"
        @ended="handleVideoEnded"
        @error="handleVideoError"
        :poster="thumbnail"
      />

      <div class="video-overlay" v-if="loading || error">
        <v-progress-circular
          v-if="loading"
          indeterminate
          color="primary"
          size="64"
        />
        <div v-if="error" class="error-message">
          <v-icon size="48" color="error">mdi-alert-circle</v-icon>
          <span>{{ error }}</span>
          <v-btn color="primary" @click="initializeVideo">Retry</v-btn>
        </div>
      </div>

      <div
        class="video-controls"
        v-show="!error"
        @mouseover="showControls = true"
        @mouseleave="showControls = false"
      >
        <!-- Progress bar -->
        <div class="progress-container" @click="handleProgressClick">
          <div class="progress-bar">
            <div
              class="progress-filled"
              :style="{ width: \`\${progress}%\` }"
            />
          </div>
          <div class="time-display">
            {{ formatTime(currentTime) }} / {{ formatTime(duration) }}
          </div>
        </div>

        <!-- Control buttons -->
        <div class="controls-row">
          <v-btn
            icon
            @click="togglePlayPause"
            :title="isPlaying ? 'Pause' : 'Play'"
          >
            <v-icon>
              {{ isPlaying ? 'mdi-pause' : 'mdi-play' }}
            </v-icon>
          </v-btn>

          <v-btn
            icon
            @click="toggleMute"
            :title="isMuted ? 'Unmute' : 'Mute'"
          >
            <v-icon>
              {{ getVolumeIcon }}
            </v-icon>
          </v-btn>

          <v-slider
            v-model="volume"
            class="volume-slider"
            min="0"
            max="1"
            step="0.1"
            hide-details
          />

          <v-menu>
            <template v-slot:activator="{ props }">
              <v-btn
                icon
                v-bind="props"
                :title="'Quality: ' + currentQuality"
              >
                <v-icon>mdi-quality-high</v-icon>
              </v-btn>
            </template>

            <v-list>
              <v-list-item
                v-for="quality in availableQualities"
                :key="quality.height"
                @click="setQuality(quality)"
                :title="quality.height + 'p'"
              >
                <template v-slot:prepend>
                  <v-icon
                    v-if="quality.height === currentQuality"
                    color="primary"
                  >
                    mdi-check
                  </v-icon>
                </template>
              </v-list-item>
            </v-list>
          </v-menu>

          <v-menu>
            <template v-slot:activator="{ props }">
              <v-btn
                icon
                v-bind="props"
                :title="'Playback Speed: ' + playbackRate + 'x'"
              >
                <v-icon>mdi-speed</v-icon>
              </v-btn>
            </template>

            <v-list>
              <v-list-item
                v-for="speed in playbackSpeeds"
                :key="speed"
                @click="setPlaybackRate(speed)"
                :title="speed + 'x'"
              >
                <template v-slot:prepend>
                  <v-icon
                    v-if="speed === playbackRate"
                    color="primary"
                  >
                    mdi-check
                  </v-icon>
                </template>
              </v-list-item>
            </v-list>
          </v-menu>

          <v-btn
            icon
            @click="togglePictureInPicture"
            :title="'Picture in Picture'"
            v-if="isPiPSupported"
          >
            <v-icon>mdi-picture-in-picture-bottom-right</v-icon>
          </v-btn>

          <v-btn
            icon
            @click="toggleFullscreen"
            :title="isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'"
          >
            <v-icon>
              {{ isFullscreen ? 'mdi-fullscreen-exit' : 'mdi-fullscreen' }}
            </v-icon>
          </v-btn>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
import { VideoService } from '@/services/video-service';
import { formatDuration } from '@/utils/formatters';

const props = defineProps<{
  src: string;
  thumbnail?: string;
  autoplay?: boolean;
  immersiveMode?: 'vr' | 'ar' | 'hologram';
  labEnvironment?: {
    type: 'chemistry' | 'physics';
    scene: string;
    objects: Array<{
      id: string;
      model: string;
      position: [number, number, number];
      rotation: [number, number, number];
      interactive: boolean;
    }>;
  };
}>();

const emit = defineEmits<{
  (e: 'timeupdate', time: number): void;
  (e: 'ended'): void;
  (e: 'error', error: Error): void;
}>();

// Refs
const videoContainer = ref<HTMLDivElement | null>(null);
const videoElement = ref<HTMLVideoElement | null>(null);
const videoService = ref<VideoService | null>(null);

// State
const loading = ref(true);
const error = ref<string | null>(null);
const showControls = ref(false);
const isPlaying = ref(false);
const isMuted = ref(false);
const volume = ref(1);
const currentTime = ref(0);
const duration = ref(0);
const playbackRate = ref(1);
const isFullscreen = ref(false);
const currentQuality = ref('auto');

// Immersive Learning State
const xrSession = ref<XRSession | null>(null);
const webGLRenderer = ref<THREE.WebGLRenderer | null>(null);
const scene = ref<THREE.Scene | null>(null);
const camera = ref<THREE.PerspectiveCamera | null>(null);
const hologramMesh = ref<THREE.Mesh | null>(null);
const labObjects = ref<Map<string, THREE.Object3D>>(new Map());
const isImmersive = ref(false);

// Constants
const playbackSpeeds = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

// Computed
const progress = computed(() => {
  return (currentTime.value / duration.value) * 100 || 0;
});

const getVolumeIcon = computed(() => {
  if (isMuted.value || volume.value === 0) return 'mdi-volume-off';
  if (volume.value < 0.5) return 'mdi-volume-low';
  return 'mdi-volume-high';
});

const isPiPSupported = computed(() => {
  return document.pictureInPictureEnabled;
});

const availableQualities = computed(() => {
  return videoService.value?.getAvailableQualities() || [];
});

// Methods
const initializeVideo = async () => {
  if (!videoElement.value) return;

  try {
    loading.value = true;
    error.value = null;

    videoService.value = new VideoService();
    videoService.value.initializePlayer(
      videoElement.value,
      props.src,
      handleVideoError,
    );

    if (props.autoplay) {
      await videoService.value.play();
    }

    if (props.immersiveMode) {
      await initializeImmersiveEnvironment();
    }
  } catch (err) {
    handleVideoError(err);
  } finally {
    loading.value = false;
  }
};

const initializeImmersiveEnvironment = async () => {
  if (!videoContainer.value) return;

  try {
    // Initialize Three.js
    const THREE = await import('three');
    webGLRenderer.value = new THREE.WebGLRenderer({ antialias: true });
    scene.value = new THREE.Scene();
    camera.value = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

    // Set up WebXR
    if (props.immersiveMode === 'vr' || props.immersiveMode === 'ar') {
      if (navigator.xr) {
        const sessionInit = {
          optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking', 'layers'],
        };
        
        xrSession.value = await navigator.xr.requestSession(
          props.immersiveMode === 'vr' ? 'immersive-vr' : 'immersive-ar',
          sessionInit,
        );

        webGLRenderer.value.xr.enabled = true;
        webGLRenderer.value.xr.setReferenceSpaceType('local-floor');
        await webGLRenderer.value.xr.setSession(xrSession.value);
      }
    }

    // Set up lab environment
    if (props.labEnvironment) {
      const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader');
      const loader = new GLTFLoader();

      // Load scene
      const sceneModel = await loader.loadAsync(props.labEnvironment.scene);
      scene.value.add(sceneModel.scene);

      // Load interactive objects
      for (const object of props.labEnvironment.objects) {
        const model = await loader.loadAsync(object.model);
        const obj = model.scene;
        
        obj.position.set(...object.position);
        obj.rotation.set(...object.rotation);
        
        if (object.interactive) {
          obj.userData.interactive = true;
          obj.userData.id = object.id;
        }

        scene.value.add(obj);
        labObjects.value.set(object.id, obj);
      }
    }

    // Set up hologram if needed
    if (props.immersiveMode === 'hologram') {
      const geometry = new THREE.PlaneGeometry(16, 9);
      const material = new THREE.ShaderMaterial({
        uniforms: {
          videoTexture: { value: new THREE.VideoTexture(videoElement.value) },
          time: { value: 0 },
        },
        vertexShader: \`
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        \`,
        fragmentShader: \`
          uniform sampler2D videoTexture;
          uniform float time;
          varying vec2 vUv;
          
          void main() {
            vec2 uv = vUv;
            float wave = sin(uv.y * 10.0 + time) * 0.01;
            uv.x += wave;
            
            vec4 color = texture2D(videoTexture, uv);
            float scanline = sin(uv.y * 400.0 + time * 5.0) * 0.1 + 0.9;
            color.rgb *= scanline;
            
            float edge = smoothstep(0.8, 0.2, length(uv - 0.5));
            color.a *= edge;
            
            gl_FragColor = color;
          }
        \`,
        transparent: true,
        side: THREE.DoubleSide,
      });

      hologramMesh.value = new THREE.Mesh(geometry, material);
      scene.value.add(hologramMesh.value);
    }

    // Start animation loop
    if (webGLRenderer.value && scene.value && camera.value) {
      const animate = () => {
        if (hologramMesh.value) {
          hologramMesh.value.material.uniforms.time.value += 0.016;
        }

        if (xrSession.value) {
          webGLRenderer.value.render(scene.value, camera.value);
        } else {
          requestAnimationFrame(animate);
        }
      };

      animate();
    }

    isImmersive.value = true;
  } catch (err) {
    console.error('Failed to initialize immersive environment:', err);
    error.value = 'Failed to initialize immersive environment';
  }
};

const handleTimeUpdate = () => {
  if (!videoService.value) return;
  currentTime.value = videoService.value.getCurrentTime();
  emit('timeupdate', currentTime.value);
};

const handleMetadataLoaded = () => {
  if (!videoService.value) return;
  duration.value = videoService.value.getDuration();
};

const handleVideoEnded = () => {
  isPlaying.value = false;
  emit('ended');
};

const handleVideoError = (err: any) => {
  error.value = 'Failed to load video. Please try again.';
  emit('error', err);
};

const handleProgressClick = (event: MouseEvent) => {
  if (!videoService.value) return;

  const progressBar = event.currentTarget as HTMLElement;
  const rect = progressBar.getBoundingClientRect();
  const pos = (event.clientX - rect.left) / rect.width;
  const newTime = pos * duration.value;

  videoService.value.setCurrentTime(newTime);
};

const togglePlayPause = async () => {
  if (!videoService.value) return;

  if (isPlaying.value) {
    videoService.value.pause();
  } else {
    await videoService.value.play();
  }
  isPlaying.value = !isPlaying.value;
};

const toggleMute = () => {
  if (!videoService.value) return;
  videoService.value.toggleMute();
  isMuted.value = !isMuted.value;
};

const setVolume = (value: number) => {
  if (!videoService.value) return;
  videoService.value.setVolume(value);
  volume.value = value;
  isMuted.value = value === 0;
};

const setQuality = (quality: { height: number }) => {
  if (!videoService.value) return;
  videoService.value.setQuality(quality.height);
  currentQuality.value = quality.height + 'p';
};

const setPlaybackRate = (rate: number) => {
  if (!videoService.value) return;
  videoService.value.setPlaybackRate(rate);
  playbackRate.value = rate;
};

const togglePictureInPicture = () => {
  if (!videoService.value) return;
  if (document.pictureInPictureElement) {
    videoService.value.exitPictureInPicture();
  } else {
    videoService.value.requestPictureInPicture();
  }
};

const toggleFullscreen = () => {
  if (!videoContainer.value) return;

  if (!document.fullscreenElement) {
    videoContainer.value.requestFullscreen();
    isFullscreen.value = true;
  } else {
    document.exitFullscreen();
    isFullscreen.value = false;
  }
};

const formatTime = (seconds: number): string => {
  return formatDuration(seconds);
};

// Watchers
watch(() => props.src, initializeVideo);
watch(volume, setVolume);

// Lifecycle
onMounted(() => {
  initializeVideo();
});

onUnmounted(() => {
  if (videoService.value) {
    videoService.value.destroyPlayer();
  }

  if (xrSession.value) {
    xrSession.value.end();
  }

  if (webGLRenderer.value) {
    webGLRenderer.value.dispose();
  }

  if (scene.value) {
    scene.value.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        object.material.dispose();
      }
    });
  }

  labObjects.value.clear();
  isImmersive.value = false;
});
</script>

<style scoped>
.video-player {
  position: relative;
  width: 100%;
  background: #000;
  border-radius: 8px;
  overflow: hidden;
}

.video-container {
  position: relative;
  width: 100%;
  padding-top: 56.25%; /* 16:9 Aspect Ratio */
}

.video-element {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.video-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  background: rgba(0, 0, 0, 0.5);
}

.error-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  color: white;
  text-align: center;
}

.video-controls {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  padding: 16px;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.7));
  transition: opacity 0.3s;
  opacity: 0;
}

.video-container:hover .video-controls {
  opacity: 1;
}

.progress-container {
  margin-bottom: 8px;
}

.progress-bar {
  width: 100%;
  height: 4px;
  background: rgba(255, 255, 255, 0.3);
  cursor: pointer;
  border-radius: 2px;
}

.progress-filled {
  height: 100%;
  background: var(--v-theme-primary);
  border-radius: 2px;
  transition: width 0.1s linear;
}

.time-display {
  color: white;
  font-size: 12px;
  margin-top: 4px;
}

.controls-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.volume-slider {
  width: 100px;
  margin: 0 8px;
}

.is-fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 9999;
}

.is-fullscreen .video-container {
  padding-top: 0;
  height: 100%;
}
</style>