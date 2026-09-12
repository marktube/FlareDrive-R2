const THUMBNAIL_SIZE = 144;

async function captureImageFrame(ctx, srcUrl) {
  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("图片加载失败"));
    img.src = srcUrl;
  });
  ctx.drawImage(image, 0, 0, THUMBNAIL_SIZE, THUMBNAIL_SIZE);
}

async function captureVideoFrame(ctx, srcUrl, timeoutMs) {
  const video = await new Promise((resolve, reject) => {
    const videoEl = document.createElement("video");
    videoEl.muted = true;
    videoEl.playsInline = true; // 避免部分移动端浏览器把视频拉到全屏播放
    videoEl.preload = "auto";
    videoEl.src = srcUrl;

    // 原来固定写死 2 秒超时，且成功之后从不清除这个定时器：
    // 对文件稍大一些的视频（尤其是 moov 元数据在文件末尾的常见"非快速启动"
    // MP4，解码器需要更多时间才能定位到第一帧）经常来不及在 2 秒内完成，
    // 导致缩略图生成直接失败、customMetadata.thumbnail 永远为空，
    // 但小文件因为够快、resolve 先一步完成而看不出问题——这正好和
    // "部分视频有缩略图、部分没有"的现象吻合。这里改成随文件大小适当放宽，
    // 并且无论成功失败都会正确清掉这个定时器。
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Video load timeout"));
    }, timeoutMs);

    function cleanup() {
      clearTimeout(timer);
      videoEl.removeEventListener("loadeddata", onLoadedData);
      videoEl.removeEventListener("seeked", onSeeked);
      videoEl.removeEventListener("error", onError);
    }

    function onSeeked() {
      cleanup();
      resolve(videoEl);
    }

    async function onLoadedData() {
      try {
        // 很多视频第 0 帧是全黑/过渡帧，取靠前一点但非 0 的时间点效果更好；
        // 关键是要真正监听 "seeked" 事件之后再截帧，而不是设置完
        // currentTime 就假定已经跳转完成——seek 本身是异步的。
        videoEl.currentTime = Math.min(0.1, (videoEl.duration || 0.2) / 2);
      } catch (seekErr) {
        cleanup();
        reject(seekErr);
      }
    }

    function onError() {
      // 容器是 .mp4/.mov 等后缀，不代表浏览器一定能解码其内部的具体编码格式，
      // 遇到不支持的编码或文件损坏时，浏览器会触发 error 事件。
      // 之前的代码完全没有监听这个事件，只能死等 2 秒超时，
      // 现在改为一旦确定加载失败就立刻放弃，不再生成缩略图（走上传流程原有的
      // try/catch 兜底，回退到通用文件图标），也不会再产生一张空白缩略图。
      // 注意：如果是浏览器本身就无法解码的编码格式（比如某些 HEVC/H.265），
      // 这里也只能识别到"加载失败"，没有办法在纯前端把它解码出来。
      cleanup();
      reject(new Error("Video failed to load: " + (videoEl.error ? videoEl.error.message : "unknown error")));
    }

    videoEl.addEventListener("loadeddata", onLoadedData, { once: true });
    videoEl.addEventListener("seeked", onSeeked);
    videoEl.addEventListener("error", onError);
  });
  ctx.drawImage(video, 0, 0, THUMBNAIL_SIZE, THUMBNAIL_SIZE);
}

/**
 * @param {File} file
 */
export async function generateThumbnail(file) {
  const canvas = document.createElement("canvas");
  canvas.width = THUMBNAIL_SIZE;
  canvas.height = THUMBNAIL_SIZE;
  const ctx = canvas.getContext("2d");

  const objectUrl = URL.createObjectURL(file);
  try {
    if (file.type.startsWith("image/")) {
      await captureImageFrame(ctx, objectUrl);
    } else if (file.type.startsWith("video/")) {
      // 本地 Blob 已经完整存在于内存/磁盘里，这里的耗时主要来自浏览器解码器
      // 定位首帧所需的时间，文件越大通常越久，所以超时随文件大小适当放宽。
      const timeoutMs = Math.min(20000, Math.max(5000, (file.size / (1024 * 1024)) * 300));
      await captureVideoFrame(ctx, objectUrl, timeoutMs);
    }
  } finally {
    URL.revokeObjectURL(objectUrl);
  }

  /** @type Blob */
  const thumbnailBlob = await new Promise((resolve) =>
    canvas.toBlob((blob) => resolve(blob))
  );

  return thumbnailBlob;
}

/**
 * 直接基于一个支持 Range 请求的网络地址生成缩略图，不需要先把整个文件下载到
 * 内存里再解码。用于"重新生成缩略图"这种针对已存在文件的场景——<video> 标签
 * 本身就支持按需分段（Range）请求，只要 srcUrl 指向的接口正确转发 Range 头
 * （本项目的 /raw/ 接口是这样的），浏览器就只会拉取定位到某一帧所需的那部分
 * 数据，而不是整份文件，这对大视频文件明显更快、也更省内存。
 * @param {string} srcUrl
 * @param {string} type MIME 类型，例如 "video/mp4"、"image/png"
 * @param {number} [timeoutMs]
 */
export async function generateThumbnailFromUrl(srcUrl, type, timeoutMs = 15000) {
  if (!type || (!type.startsWith("image/") && !type.startsWith("video/"))) {
    return null;
  }

  const canvas = document.createElement("canvas");
  canvas.width = THUMBNAIL_SIZE;
  canvas.height = THUMBNAIL_SIZE;
  const ctx = canvas.getContext("2d");

  if (type.startsWith("image/")) {
    await captureImageFrame(ctx, srcUrl);
  } else {
    await captureVideoFrame(ctx, srcUrl, timeoutMs);
  }

  return await new Promise((resolve) => canvas.toBlob((blob) => resolve(blob)));
}

/**
 * @param {Blob} blob
 */
export async function blobDigest(blob) {
  const digest = await crypto.subtle.digest("SHA-1", await blob.arrayBuffer());
  const digestArray = Array.from(new Uint8Array(digest));
  const digestHex = digestArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return digestHex;
}

export const SIZE_LIMIT = 100 * 1000 * 1000; // 100MB

/**
 * @param {string} key
 * @param {File} file
 * @param {Record<string, any>} options
 */
export async function multipartUpload(key, file, options) {
  const headers = options?.headers || {};
  headers["content-type"] = file.type;

  const uploadId = await axios
    .post(`/api/write/items/${key}?uploads`, "", { headers })
    .then((res) => res.data.uploadId);
  const totalChunks = Math.ceil(file.size / SIZE_LIMIT);

  const promiseGenerator = function* () {
    for (let i = 1; i <= totalChunks; i++) {
      const chunk = file.slice((i - 1) * SIZE_LIMIT, i * SIZE_LIMIT);
      const searchParams = new URLSearchParams({ partNumber: i, uploadId });
      yield axios
        .put(`/api/write/items/${key}?${searchParams}`, chunk, {
          onUploadProgress(progressEvent) {
            if (typeof options?.onUploadProgress !== "function") return;
            options.onUploadProgress({
              loaded: (i - 1) * SIZE_LIMIT + progressEvent.loaded,
              total: file.size,
            });
          },
        })
        .then((res) => ({
          partNumber: i,
          etag: res.headers.etag,
        }));
    }
  };

  const uploadedParts = [];
  for (const part of promiseGenerator()) {
    const { partNumber, etag } = await part;
    uploadedParts[partNumber - 1] = { partNumber, etag };
  }
  const completeParams = new URLSearchParams({ uploadId });
  await axios.post(`/api/write/items/${key}?${completeParams}`, {
    parts: uploadedParts,
  });
}
