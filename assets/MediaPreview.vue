<template>
  <div v-if="show" class="media-preview-overlay" @click="closePreview">
    <div class="media-preview-container" @click.stop @touchstart="onContainerTouch">
      <!-- 加载状态 -->
      <div v-if="loading" class="loading-indicator">
        <div class="spinner"></div>
        <p>加载中...</p>
        <p style="font-size: 12px; opacity: 0.7;">{{ currentMedia.url }}</p>
        <!-- 加载状态下的关闭按钮 -->
        <button class="control-btn close-btn loading-close-btn" @click="closePreview" title="关闭">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z" />
          </svg>
        </button>
      </div>

      <!-- 图片预览 -->
      <div v-else-if="isImage" class="image-viewer" id="pr-img-view">
        <img
          :src="currentMedia.url"
          :alt="currentMedia.name"
          class="preview-image"
          :style="imageStyle"
          @load="onImageLoad"
          @error="onImageError"
          @dblclick="onDoubleClick"
          @mousedown="onMouseDown"
          @wheel="onWheel"
          @touchstart="onTouchStart"
          @touchmove="onTouchMove"
          @touchend="onTouchEnd"
        />
      </div>

      <!-- 视频预览 -->
      <div v-else-if="isVideo" class="video-viewer">
        <video 
          :src="currentMedia.url"
          class="preview-video"
          controls
          autoplay
          @loadeddata="onVideoLoad"
          @error="onVideoError"
        >
          您的浏览器不支持视频播放
        </video>
      </div>

      <!-- 错误状态 -->
      <div v-else-if="error" class="error-state">
        <svg viewBox="0 0 24 24" width="48" height="48" fill="#ff6b6b">
          <path d="M12,2C17.53,2 22,6.47 22,12C22,17.53 17.53,22 12,22C6.47,22 2,17.53 2,12C2,6.47 6.47,2 12,2M15.59,7L12,10.59L8.41,7L7,8.41L10.59,12L7,15.59L8.41,17L12,13.41L15.59,17L17,15.59L13.41,12L17,8.41L15.59,7Z" />
        </svg>
        <p>{{ errorMessage }}</p>
      </div>

      <!-- 控制栏 -->
      <div v-if="!loading && !error" class="preview-controls"
           @mousemove="onControlsMouseMove"
           @mouseleave="onControlsMouseLeave">

        <!-- 隐藏状态提示（仅移动端） -->
        <div v-if="isMobile && controlsAutoHide" class="controls-hint" @click="showControls">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="white">
            <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9Z" />
          </svg>
          <span>点击显示控制</span>
        </div>
        <!-- 移动端顶部控制栏 -->
        <div v-if="isMobile" class="mobile-top-controls" :class="{ 'auto-hide': controlsAutoHide }">
          <div class="media-info">
            <span class="media-name">{{ currentMedia.name }}</span>
            <span v-if="filteredMediaList.length > 1" class="media-counter">
              {{ currentIndex + 1 }} / {{ filteredMediaList.length }}
            </span>
          </div>
          <div class="mobile-top-actions">
            <!-- 下载按钮 -->
            <button class="control-btn" @click="downloadMedia" title="下载">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <path d="M5,20H19V18H5M19,9H15V3H9V9H5L12,16L19,9Z" />
              </svg>
            </button>
            <!-- 分享按钮 -->
            <button class="control-btn" @click="shareMedia" title="分享">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <path d="M18,16.08C17.24,16.08 16.56,16.38 16.04,16.85L8.91,12.7C8.96,12.47 9,12.24 9,12C9,11.76 8.96,11.53 8.91,11.3L15.96,7.19C16.5,7.69 17.21,8 18,8A3,3 0 0,0 21,5A3,3 0 0,0 18,2A3,3 0 0,0 15,5C15,5.24 15.04,5.47 15.09,5.7L8.04,9.81C7.5,9.31 6.79,9 6,9A3,3 0 0,0 3,12A3,3 0 0,0 6,15C6.79,15 7.5,14.69 8.04,14.19L15.16,18.34C15.11,18.55 15.08,18.77 15.08,19C15.08,20.61 16.39,21.91 18,21.91C19.61,21.91 20.92,20.6 20.92,19A2.92,2.92 0 0,0 18,16.08Z" />
              </svg>
            </button>
            <!-- 关闭按钮 -->
            <button class="control-btn close-btn" @click="closePreview" title="关闭">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z" />
              </svg>
            </button>
          </div>
        </div>

        <!-- 桌面端顶部控制栏 -->
        <div v-else class="top-controls" :class="{ 'auto-hide': controlsAutoHide }">
          <div class="media-info">
            <span class="media-name">{{ currentMedia.name }}</span>
            <span v-if="filteredMediaList.length > 1" class="media-counter">
              {{ currentIndex + 1 }} / {{ filteredMediaList.length }}
            </span>
          </div>
          <div class="top-actions">
            <!-- 下载按钮 -->
            <button class="control-btn" @click="downloadMedia" title="下载">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <path d="M5,20H19V18H5M19,9H15V3H9V9H5L12,16L19,9Z" />
              </svg>
            </button>
            <!-- 分享按钮 -->
            <button class="control-btn" @click="shareMedia" title="分享">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <path d="M18,16.08C17.24,16.08 16.56,16.38 16.04,16.85L8.91,12.7C8.96,12.47 9,12.24 9,12C9,11.76 8.96,11.53 8.91,11.3L15.96,7.19C16.5,7.69 17.21,8 18,8A3,3 0 0,0 21,5A3,3 0 0,0 18,2A3,3 0 0,0 15,5C15,5.24 15.04,5.47 15.09,5.7L8.04,9.81C7.5,9.31 6.79,9 6,9A3,3 0 0,0 3,12A3,3 0 0,0 6,15C6.79,15 7.5,14.69 8.04,14.19L15.16,18.34C15.11,18.55 15.08,18.77 15.08,19C15.08,20.61 16.39,21.91 18,21.91C19.61,21.91 20.92,20.6 20.92,19A2.92,2.92 0 0,0 18,16.08Z" />
              </svg>
            </button>
            <!-- 关闭按钮 -->
            <button class="control-btn close-btn" @click="closePreview" title="关闭">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z" />
              </svg>
            </button>
          </div>
        </div>

        <!-- 左右导航按钮 -->
        <div v-if="filteredMediaList.length > 1" class="side-navigation">
          <!-- 左侧上一张按钮 -->
          <button
            class="control-btn nav-btn side-nav-btn left-nav"
            @click="previousMedia"
            :disabled="currentIndex === 0"
            title="上一张"
          >
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
              <path d="M15.41,16.58L10.83,12L15.41,7.41L14,6L8,12L14,18L15.41,16.58Z" />
            </svg>
          </button>

          <!-- 右侧下一张按钮 -->
          <button
            class="control-btn nav-btn side-nav-btn right-nav"
            @click="nextMedia"
            :disabled="currentIndex === filteredMediaList.length - 1"
            title="下一张"
          >
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
              <path d="M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z" />
            </svg>
          </button>
        </div>

        <!-- 底部控制栏 - 仅显示图片控制按钮 -->
        <div v-if="isImage && isShowBottom" class="bottom-controls">
          <!-- 图片控制按钮 -->
          <div class="image-controls">
            <button class="control-btn" @click="zoomOut" title="缩小">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <path d="M15.5,14L20.5,19L19,20.5L14,15.5V14.71L13.73,14.43C12.59,15.41 11.11,16 9.5,16A6.5,6.5 0 0,1 3,9.5A6.5,6.5 0 0,1 9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.43,13.73L14.71,14H15.5M9.5,14C12,14 14,12 14,9.5C14,7 12,5 9.5,5C7,5 5,7 5,9.5C5,12 7,14 9.5,14M7,9V10H12V9H7Z" />
              </svg>
            </button>

            <span class="zoom-level">{{ Math.round(scale * 100) }}%</span>

            <button class="control-btn" @click="zoomIn" title="放大">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <path d="M15.5,14L20.5,19L19,20.5L14,15.5V14.71L13.73,14.43C12.59,15.41 11.11,16 9.5,16A6.5,6.5 0 0,1 3,9.5A6.5,6.5 0 0,1 9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.43,13.73L14.71,14H15.5M9.5,14C12,14 14,12 14,9.5C14,7 12,5 9.5,5C7,5 5,7 5,9.5C5,12 7,14 9.5,14M10,7H9V9H7V10H9V12H10V10H12V9H10V7Z" />
              </svg>
            </button>

            <button class="control-btn" @click="rotateImage" title="旋转">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <path d="M12,3A9,9 0 0,0 3,12H0L4,16L8,12H5A7,7 0 0,1 12,5A7,7 0 0,1 19,12A7,7 0 0,1 12,19C10.5,19 9.09,18.5 7.94,17.7L6.5,19.14C8.04,20.3 9.94,21 12,21A9,9 0 0,0 21,12A9,9 0 0,0 12,3Z" />
              </svg>
            </button>

            <button class="control-btn" @click="resetImage" title="重置">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <path d="M12,3A9,9 0 0,1 21,12A9,9 0 0,1 12,21A9,9 0 0,1 3,12A9,9 0 0,1 12,3M12,7A5,5 0 0,0 7,12A5,5 0 0,0 12,17A5,5 0 0,0 17,12A5,5 0 0,0 12,7M12,9A3,3 0 0,1 15,12A3,3 0 0,1 12,15A3,3 0 0,1 9,12A3,3 0 0,1 12,9Z" />
              </svg>
            </button>

            <button v-if="this.currentMedia.size > 30 * 1024 * 1024" class="control-btn" @click="panoImage" title="全景模式">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <path d="M5 5 L15 5 L15 15 L5 15 Z" />
              </svg>
            </button>
          </div>
        </div>


      </div>
    </div>

    <!-- 分享模态框 -->
    <div v-if="showShareModal" class="share-modal" @click="showShareModal = false">
      <div class="share-content" @click.stop>
        <h3>分享文件</h3>
        <div v-if="isMobile" class="mobile-share-options">
          <button class="share-option" @click="shareToWechat">
            <span>分享到微信好友</span>
          </button>
          <button class="share-option" @click="shareToMoments">
            <span>分享到朋友圈</span>
          </button>
          <button class="share-option" @click="copyShareLink">
            <span>复制链接</span>
          </button>
        </div>
        <div v-else class="desktop-share-options">
          <div class="qr-code-container">
            <canvas ref="qrCanvas" width="200" height="200"></canvas>
            <p>扫描二维码分享</p>
          </div>
          <button class="share-option" @click="copyShareLink">
            <span>复制链接</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'MediaPreview',
  props: {
    show: {
      type: Boolean,
      default: false
    },
    mediaList: {
      type: Array,
      default: () => []
    },
    initialIndex: {
      type: Number,
      default: 0
    }
  },
  emits: ['close'],
  data() {
    return {
      currentIndex: 0,
      loading: true,
      error: false,
      errorMessage: '',
      
      // 图片变换状态
      scale: 1,
      rotation: 0,
      translateX: 0,
      translateY: 0,
      
      // 拖拽状态
      isDragging: false,
      dragStartX: 0,
      dragStartY: 0,
      lastTranslateX: 0,
      lastTranslateY: 0,

      // 触摸状态
      touches: [],
      lastTouchDistance: 0,
      lastTouchTime: 0,

      // 滑动手势状态
      swipeStartX: 0,
      swipeStartY: 0,
      isSwipeGesture: false,
      
      // 分享相关
      showShareModal: false,

      // 移动端检测
      isMobile: false,

      // 控制栏自动隐藏
      controlsAutoHide: false,
      controlsHideTimer: null,

      // 是否显示底部控制栏
      isShowBottom: true
    }
  },
  computed: {
    currentMedia() {
      const media = this.filteredMediaList[this.currentIndex] || {};
      return media;
    },
    isImage() {
      const imageTypes = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'];
      const ext = this.currentMedia.name?.split('.').pop()?.toLowerCase();
      return imageTypes.includes(ext);
    },
    isVideo() {
      const videoTypes = ['mp4', 'webm', 'ogv', 'avi', 'mov', 'wmv'];
      const ext = this.currentMedia.name?.split('.').pop()?.toLowerCase();
      return videoTypes.includes(ext);
    },
    // 过滤后的媒体列表 - 只包含当前类型的媒体
    filteredMediaList() {
      if (!this.mediaList.length) return [];

      const currentMedia = this.mediaList[this.initialIndex];
      if (!currentMedia) return this.mediaList;

      const currentExt = currentMedia.name?.split('.').pop()?.toLowerCase();
      const imageTypes = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'];
      const videoTypes = ['mp4', 'webm', 'ogv', 'avi', 'mov', 'wmv'];

      const isCurrentImage = imageTypes.includes(currentExt);
      const isCurrentVideo = videoTypes.includes(currentExt);

      if (isCurrentImage) {
        // 如果当前是图片，只返回图片
        return this.mediaList.filter(media => {
          const ext = media.name?.split('.').pop()?.toLowerCase();
          return imageTypes.includes(ext);
        });
      } else if (isCurrentVideo) {
        // 如果当前是视频，只返回视频
        return this.mediaList.filter(media => {
          const ext = media.name?.split('.').pop()?.toLowerCase();
          return videoTypes.includes(ext);
        });
      }

      return this.mediaList;
    },
    // 当前媒体在过滤后列表中的索引
    filteredCurrentIndex() {
      if (!this.filteredMediaList.length) return 0;

      // 使用 initialIndex 来获取正确的初始媒体文件
      const currentMedia = this.mediaList[this.initialIndex];
      if (!currentMedia) return 0;

      return this.filteredMediaList.findIndex(media => media.key === currentMedia.key);
    },
    imageStyle() {
      return {
        transform: `scale(${this.scale}) rotate(${this.rotation}deg) translate(${this.translateX}px, ${this.translateY}px)`,
        transition: this.isDragging ? 'none' : 'transform 0.3s ease'
      };
    }
  },
  watch: {
    show(newVal) {
      if (newVal) {
        // 计算在过滤后列表中的正确索引
        this.currentIndex = this.filteredCurrentIndex;
        this.loading = true; // 显示时开始加载
        this.isShowBottom = true;
        this.error = false;
        this.resetImage();
        this.detectMobile();
        document.addEventListener('keydown', this.handleKeydown);
        document.body.style.overflow = 'hidden';

        // 初始化控制栏自动隐藏
        this.controlsAutoHide = false;
        this.startControlsHideTimer();

        // 强制触发图片加载检查
        this.$nextTick(() => {
          this.checkImageLoad();
        });
      } else {
        document.removeEventListener('keydown', this.handleKeydown);
        document.body.style.overflow = '';
        this.clearControlsHideTimer();
      }
    },
    currentIndex(newVal) {
      this.loading = true;
      this.error = false;
      this.resetImage();

      // 强制触发图片加载检查
      this.$nextTick(() => {
        this.checkImageLoad();
      });
    },
    initialIndex(newVal) {
      // 无论预览是否显示，都需要更新 currentIndex
      // 这样可以确保下次打开预览时显示正确的文件
      this.currentIndex = this.filteredCurrentIndex;
    },
    mediaList() {
      // 当媒体列表变化时，重新计算当前索引
      if (this.show) {
        this.currentIndex = this.filteredCurrentIndex;
      }
    }
  },
  methods: {
    closePreview() {
      this.$emit('close');
    },
    
    // 媒体加载处理
    onImageLoad() {
      this.loading = false;
      this.error = false;
    },
    onVideoLoad() {
      this.loading = false;
      this.error = false;
    },
    onImageError() {
      this.loading = false;
      this.error = true;
      this.errorMessage = '图片加载失败';
    },
    onVideoError() {
      console.log('视频加载失败:', this.currentMedia.url);
      this.loading = false;
      this.error = true;
      this.errorMessage = '视频加载失败';
    },
    
    // 导航控制
    previousMedia() {
      if (this.currentIndex > 0) {
        this.isShowBottom = true;
        this.currentIndex--;
      }
    },
    nextMedia() {
      if (this.currentIndex < this.filteredMediaList.length - 1) {
        this.isShowBottom = true;
        this.currentIndex++;
      }
    },
    
    // 图片控制
    zoomIn() {
      this.scale = Math.min(this.scale * 1.2, 5);
    },
    zoomOut() {
      this.scale = Math.max(this.scale / 1.2, 0.1);
    },
    rotateImage() {
      this.rotation += 90;
    },
    resetImage() {
      this.scale = 1;
      this.rotation = 0;
      this.translateX = 0;
      this.translateY = 0;
    },
    panoImage() {
      document.getElementById("pr-img-view").innerHTML = "";
      this.isShowBottom = false;
      pannellum.viewer('pr-img-view', {
        "type": "equirectangular",
        "panorama": this.currentMedia.url,
        "showFullscreenCtrl": true,
        "autoLoad": true
      });
    },
    
    // 双击放大
    onDoubleClick() {
      if (this.scale === 1) {
        this.scale = 2;
      } else {
        this.resetImage();
      }
    },
    
    // 键盘控制
    handleKeydown(e) {
      switch (e.key) {
        case 'Escape':
          this.closePreview();
          break;
        case 'ArrowLeft':
          this.previousMedia();
          break;
        case 'ArrowRight':
          this.nextMedia();
          break;
        case '+':
        case '=':
          this.zoomIn();
          break;
        case '-':
          this.zoomOut();
          break;
        case 'r':
        case 'R':
          this.rotateImage();
          break;
        case '0':
          this.resetImage();
          break;
      }
    },
    
    // 下载功能
    downloadMedia() {
      const link = document.createElement('a');
      link.href = this.currentMedia.url;
      link.download = this.currentMedia.name;
      link.click();
    },
    
    // 分享功能
    shareMedia() {
      this.showShareModal = true;
      if (!this.isMobile) {
        this.$nextTick(() => {
          this.generateQRCode();
        });
      }
    },
    
    copyShareLink() {
      const url = new URL(this.currentMedia.url, window.location.origin);
      navigator.clipboard.writeText(url.toString()).then(() => {
        this.$emit('show-toast', '链接已复制到剪贴板', 'success');
        this.showShareModal = false;
      });
    },

    shareToWechat() {
      // 微信分享逻辑（需要微信SDK）
      this.$emit('show-toast', '微信分享功能需要在微信环境中使用', 'warning');
    },

    shareToMoments() {
      // 朋友圈分享逻辑（需要微信SDK）
      this.$emit('show-toast', '朋友圈分享功能需要在微信环境中使用', 'warning');
    },
    
    async generateQRCode() {
      const canvas = this.$refs.qrCanvas;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      const url = new URL(this.currentMedia.url, window.location.origin).toString();

      // 检查是否配置了外部二维码API
      const qrcodeApi = window.ENV?.QRCODE_API || '';

      if (qrcodeApi) {
        try {
          // 使用外部API生成二维码
          const qrUrl = `${qrcodeApi}${encodeURIComponent(url)}`;
          const img = new Image();
          img.crossOrigin = 'anonymous';

          img.onload = () => {
            ctx.clearRect(0, 0, 200, 200);
            ctx.drawImage(img, 0, 0, 200, 200);
          };

          img.onerror = () => {
            this.drawQRPlaceholder(ctx, '二维码生成失败');
          };

          img.src = qrUrl;
        } catch (error) {
          console.error('二维码生成错误:', error);
          this.drawQRPlaceholder(ctx, '二维码生成失败');
        }
      } else {
        // 没有配置API，显示提示信息
        this.drawQRPlaceholder(ctx, '需要配置QRCODE_API');
      }
    },

    drawQRPlaceholder(ctx, message) {
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(0, 0, 200, 200);
      ctx.fillStyle = '#333';
      ctx.font = '14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('QR Code', 100, 90);
      ctx.fillText(message, 100, 110);
      ctx.font = '12px Arial';
      ctx.fillStyle = '#666';
      ctx.fillText('请配置环境变量', 100, 130);
      ctx.fillText('QRCODE_API', 100, 145);
    },
    
    detectMobile() {
      this.isMobile = window.innerWidth <= 768 || /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    },

    // 控制栏自动隐藏功能
    startControlsHideTimer() {
      this.clearControlsHideTimer();
      this.controlsHideTimer = setTimeout(() => {
        this.controlsAutoHide = true;
      }, 3000); // 3秒后自动隐藏
    },

    clearControlsHideTimer() {
      if (this.controlsHideTimer) {
        clearTimeout(this.controlsHideTimer);
        this.controlsHideTimer = null;
      }
    },

    showControls() {
      this.controlsAutoHide = false;
      this.startControlsHideTimer();
    },

    onControlsMouseMove() {
      this.showControls();
    },

    onControlsMouseLeave() {
      this.startControlsHideTimer();
    },

    // 移动端触摸显示控制栏
    onContainerTouch() {
      if (this.isMobile) {
        this.showControls();
      }
    },

    // 检查图片加载状态
    checkImageLoad() {
      if (!this.currentMedia.url) {
        return;
      }

      // 创建一个新的图片对象来测试加载
      const img = new Image();
      img.onload = () => {
        this.onImageLoad();
      };
      img.onerror = () => {
        this.onImageError();
      };
      img.src = this.currentMedia.url;
    },

    // 鼠标拖拽处理
    onMouseDown(e) {
      if (this.scale <= 1) return;

      this.isDragging = true;
      this.dragStartX = e.clientX - this.translateX;
      this.dragStartY = e.clientY - this.translateY;

      document.addEventListener('mousemove', this.onMouseMove);
      document.addEventListener('mouseup', this.onMouseUp);
      e.preventDefault();
    },

    onMouseMove(e) {
      if (!this.isDragging) return;

      this.translateX = e.clientX - this.dragStartX;
      this.translateY = e.clientY - this.dragStartY;
    },

    onMouseUp() {
      this.isDragging = false;
      document.removeEventListener('mousemove', this.onMouseMove);
      document.removeEventListener('mouseup', this.onMouseUp);
    },

    // 滚轮缩放
    onWheel(e) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      this.scale = Math.max(0.1, Math.min(5, this.scale * delta));
    },

    // 触摸处理
    onTouchStart(e) {
      this.touches = Array.from(e.touches);
      this.lastTouchTime = Date.now();

      if (this.touches.length === 1) {
        const touch = this.touches[0];
        this.swipeStartX = touch.clientX;
        this.swipeStartY = touch.clientY;
        this.isSwipeGesture = false;

        // 单指拖拽（仅在图片放大时）
        if (this.scale > 1) {
          this.isDragging = true;
          this.dragStartX = touch.clientX - this.translateX;
          this.dragStartY = touch.clientY - this.translateY;
        }
      } else if (this.touches.length === 2) {
        // 双指缩放
        this.lastTouchDistance = this.getTouchDistance();
        this.isSwipeGesture = false;
      }

      e.preventDefault();
    },

    onTouchMove(e) {
      this.touches = Array.from(e.touches);

      if (this.touches.length === 1) {
        const touch = this.touches[0];
        const deltaX = touch.clientX - this.swipeStartX;
        const deltaY = touch.clientY - this.swipeStartY;

        // 检测是否为滑动手势（移动端导航）
        if (!this.isSwipeGesture && this.isMobile && this.scale <= 1 && this.filteredMediaList.length > 1) {
          const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
          if (distance > 30) { // 滑动阈值
            const angle = Math.abs(Math.atan2(deltaY, deltaX) * 180 / Math.PI);
            if (angle < 30 || angle > 150) { // 水平滑动
              this.isSwipeGesture = true;
            }
          }
        }

        if (this.isDragging && this.scale > 1) {
          // 单指拖拽（图片放大时）
          this.translateX = touch.clientX - this.dragStartX;
          this.translateY = touch.clientY - this.dragStartY;
        }
      } else if (this.touches.length === 2) {
        // 双指缩放
        const currentDistance = this.getTouchDistance();
        if (this.lastTouchDistance > 0) {
          const scaleChange = currentDistance / this.lastTouchDistance;
          this.scale = Math.max(0.1, Math.min(5, this.scale * scaleChange));
        }
        this.lastTouchDistance = currentDistance;
      }

      e.preventDefault();
    },

    onTouchEnd(e) {
      const touchTime = Date.now() - this.lastTouchTime;

      if (e.touches.length === 0) {
        // 处理滑动手势
        if (this.isSwipeGesture && this.isMobile && this.filteredMediaList.length > 1) {
          const deltaX = e.changedTouches[0].clientX - this.swipeStartX;
          const threshold = 80; // 滑动阈值

          if (Math.abs(deltaX) > threshold) {
            if (deltaX > 0 && this.currentIndex > 0) {
              // 向右滑动 - 上一张
              this.previousMedia();
            } else if (deltaX < 0 && this.currentIndex < this.filteredMediaList.length - 1) {
              // 向左滑动 - 下一张
              this.nextMedia();
            }
          }
        }

        // 检测双击
        if (touchTime < 300 && !this.isSwipeGesture) {
          if (this.lastTouchEndTime && (Date.now() - this.lastTouchEndTime) < 300) {
            this.onDoubleClick();
          }
          this.lastTouchEndTime = Date.now();
        }
      }

      this.isDragging = false;
      this.touches = [];
      this.lastTouchDistance = 0;
      this.isSwipeGesture = false;
    },

    // 计算两指间距离
    getTouchDistance() {
      if (this.touches.length < 2) return 0;

      const dx = this.touches[0].clientX - this.touches[1].clientX;
      const dy = this.touches[0].clientY - this.touches[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    }
  }
}
</script>

<style scoped>
.media-preview-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.9);
  z-index: 10001;
  display: flex;
  align-items: center;
  justify-content: center;
}

.media-preview-container {
  position: relative;
  width: 90%;
  height: 90%;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 加载状态 */
.loading-indicator {
  text-align: center;
  color: white;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(255, 255, 255, 0.3);
  border-top: 4px solid white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 20px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* 图片查看器 */
.image-viewer {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.preview-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  cursor: grab;
  user-select: none;
}

.preview-image:active {
  cursor: grabbing;
}

/* 视频查看器 */
.video-viewer {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.preview-video {
  max-width: 100%;
  max-height: 100%;
  outline: none;
}

/* 错误状态 */
.error-state {
  text-align: center;
  color: white;
}

.error-state svg {
  margin-bottom: 20px;
}

/* 控制栏 */
.preview-controls {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
}

/* 控制提示 */
.controls-hint {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(0, 0, 0, 0.6);
  color: white;
  padding: 12px 20px;
  border-radius: 25px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  pointer-events: auto;
  cursor: pointer;
  backdrop-filter: blur(10px);
  animation: fadeInOut 2s ease-in-out infinite;
}

@keyframes fadeInOut {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}

.top-controls {
  position: absolute;
  top: 20px;
  left: 20px;
  right: 20px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  pointer-events: auto;
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.top-controls.auto-hide {
  opacity: 0.3;
  transform: translateY(-10px);
}

.top-controls:hover {
  opacity: 1 !important;
  transform: translateY(0) !important;
}

.media-info {
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 10px 15px;
  border-radius: 8px;
  backdrop-filter: blur(10px);
  transition: all 0.3s ease;
}

/* 自动隐藏时降低透明度 */
.auto-hide .media-info {
  background: rgba(0, 0, 0, 0.3);
  opacity: 0.6;
}

.media-name {
  display: block;
  font-weight: 500;
  margin-bottom: 4px;
}

.media-counter {
  font-size: 14px;
  opacity: 0.8;
}

.top-actions {
  display: flex;
  gap: 8px;
}

/* 左右导航按钮 */
.side-navigation {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
}

.side-nav-btn {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: auto;
  width: 60px;
  height: 60px;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(10px);
  opacity: 0.7;
  transition: all 0.3s ease;
}

.side-nav-btn:hover {
  opacity: 1;
  background: rgba(0, 0, 0, 0.7);
  transform: translateY(-50%) scale(1.1);
}

.side-nav-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
  transform: translateY(-50%);
}

.left-nav {
  left: 20px;
}

.right-nav {
  right: 20px;
}

.bottom-controls {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 20px;
  align-items: center;
  pointer-events: auto;
}

.image-controls {
  display: flex;
  gap: 8px;
  align-items: center;
  background: rgba(0, 0, 0, 0.7);
  padding: 10px 15px;
  border-radius: 25px;
  backdrop-filter: blur(10px);
}

/* 控制按钮 */
.control-btn {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  border-radius: 50%;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  cursor: pointer;
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);
}

.control-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: scale(1.1);
}

.control-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.nav-btn {
  width: 50px;
  height: 50px;
}

.close-btn {
  background: rgba(255, 0, 0, 0.7);
}

.close-btn:hover {
  background: rgba(255, 0, 0, 0.9);
}

.zoom-level {
  color: white;
  font-size: 14px;
  font-weight: 500;
  min-width: 50px;
  text-align: center;
}

/* 加载状态下的关闭按钮 */
.loading-close-btn {
  position: absolute;
  top: 20px;
  right: 20px;
  z-index: 10;
}

/* 移动端顶部控制栏 */
.mobile-top-controls {
  position: absolute;
  top: 10px;
  left: 10px;
  right: 10px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  pointer-events: auto;
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.mobile-top-controls.auto-hide {
  opacity: 0.3;
  transform: translateY(-10px);
}

.mobile-top-controls:active,
.mobile-top-controls:focus-within {
  opacity: 1 !important;
  transform: translateY(0) !important;
}

.mobile-top-actions {
  display: flex;
  gap: 8px;
}



/* 分享模态框 */
.share-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.8);
  z-index: 10002;
  display: flex;
  align-items: center;
  justify-content: center;
}

.share-content {
  background: white;
  border-radius: 12px;
  padding: 30px;
  max-width: 400px;
  width: 90%;
  text-align: center;
}

.share-content h3 {
  margin: 0 0 20px 0;
  color: #333;
}

.mobile-share-options,
.desktop-share-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.share-option {
  background: #4CAF50;
  color: white;
  border: none;
  border-radius: 8px;
  padding: 12px 20px;
  cursor: pointer;
  transition: background 0.3s ease;
}

.share-option:hover {
  background: #45a049;
}

.qr-code-container {
  margin-bottom: 20px;
}

.qr-code-container canvas {
  border: 1px solid #ddd;
  border-radius: 8px;
}

.qr-code-container p {
  margin: 10px 0 0 0;
  color: #666;
  font-size: 14px;
}

/* 移动端优化 */
@media (max-width: 768px) {
  .media-preview-container {
    width: 100%;
    height: 100%;
  }

  .loading-close-btn {
    top: 10px;
    right: 10px;
  }

  .mobile-top-controls .media-info {
    padding: 8px 12px;
    font-size: 14px;
  }

  .side-nav-btn {
    width: 50px;
    height: 50px;
  }

  .left-nav {
    left: 10px;
  }

  .right-nav {
    right: 10px;
  }

  .bottom-controls {
    bottom: 10px;
  }

  .image-controls {
    padding: 8px 12px;
    gap: 6px;
  }

  .control-btn {
    width: 50px;
    height: 50px;
  }

  .zoom-level {
    font-size: 12px;
    min-width: 40px;
  }

  .share-content {
    padding: 20px;
    margin: 20px;
  }

  /* 隐藏桌面端顶部控制栏 */
  .top-controls {
    display: none;
  }
}

/* 极小屏幕优化 */
@media (max-width: 480px) {
  .mobile-top-controls {
    flex-direction: column;
    gap: 10px;
    align-items: stretch;
  }

  .mobile-top-actions {
    justify-content: center;
  }

  .side-nav-btn {
    width: 45px;
    height: 45px;
  }

  .image-controls {
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
  }

  .control-btn {
    width: 45px;
    height: 45px;
  }

  .zoom-level {
    font-size: 11px;
    min-width: 35px;
  }
}
</style>
