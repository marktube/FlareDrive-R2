<template>
  <div class="main" 
      @dragenter.prevent 
      @dragover.prevent 
      @drop.prevent="onDrop"
      :style="{ backgroundImage: `url('${backgroundImageUrl}')` }"
  >
    <progress v-if="uploadProgress !== null" :value="uploadProgress" max="100"></progress>
    <UploadPopup v-model="showUploadPopup" @upload="onUploadClicked" @createFolder="createFolder"></UploadPopup>



    <!-- 登录/用户模态框 -->
    <div v-if="showModal" class="modal-overlay" @click="closeModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>{{ isLoggedIn ? '用户管理' : '登录' }}</h3>
          <button class="close-button" @click="closeModal">&times;</button>
        </div>
        <div class="modal-body">
          <!-- 已登录状态 -->
          <div v-if="isLoggedIn" class="user-info">
            <div class="current-user">
              <svg viewBox="0 0 24 24" width="32" height="32" fill="#4CAF50">
                <path d="M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z" />
              </svg>
              <div>
                <p class="user-status">{{ getUserStatusText() }}</p>
                <p class="user-desc">{{ getUserDescText() }}</p>
              </div>
            </div>
            <div class="user-actions">
              <button @click="switchUser" class="switch-user-button">切换用户</button>
              <button @click="logout" class="logout-button">退出登录</button>
            </div>
          </div>

          <!-- 未登录状态 -->
          <form v-else @submit.prevent="handleLogin">
            <div class="form-group">
              <label for="username">用户名:</label>
              <input
                type="text"
                id="username"
                v-model="loginForm.username"
                required
                autocomplete="username"
              >
            </div>
            <div class="form-group">
              <label for="password">密码:</label>
              <input
                type="password"
                id="password"
                v-model="loginForm.password"
                required
                autocomplete="current-password"
              >
            </div>
            <div class="form-actions">
              <button type="button" @click="closeModal" class="cancel-button">取消</button>
              <button type="submit" class="login-submit-button" :disabled="loginLoading">
                {{ loginLoading ? '登录中...' : '登录' }}
              </button>
            </div>
          </form>
          <div v-if="loginError" class="error-message">{{ loginError }}</div>
        </div>
      </div>
    </div>

    <!-- 上传按钮 - 只有登录用户或有上传权限的游客才显示 -->
    <button v-if="canUpload" class="upload-button circle" @click="showUploadPopup = true">
      <svg t="1741764069699" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg"
        p-id="24280" width="24" height="24">
        <path
          d="M576 557.7088V934.4H448V560.4416l-43.8912 43.8848L313.6 513.8176l199.1232-199.1168 0.64 0.64 0.64-0.64 199.1232 199.1168-90.5088 90.5088L576 557.7088zM704 678.4h32c88.3648 0 160-71.6352 160-160s-71.6352-160-160-160c-20.5184 0-40.128 3.8592-58.1568 10.8992C670.336 270.1248 587.4944 192 486.4 192c-106.0416 0-192 85.9584-192 192 0 15.9104 1.9328 31.3728 5.5872 46.1568A127.7504 127.7504 0 0 0 256 422.4c-70.6944 0-128 57.3056-128 128s57.3056 128 128 128h64v128H256c-141.3824 0-256-114.6176-256-256 0-113.3184 73.632-209.4464 175.6608-243.136C210.0352 167.584 336.1216 64 486.4 64c121.312 0 227.552 67.712 281.7728 168.1792C912.0896 248.1792 1024 370.2208 1024 518.4c0 159.0592-128.9408 288-288 288h-32v-128z"
          fill="#e6e6e6" p-id="24281"></path>
      </svg>
    </button>
    <div class="app-bar">
      <a class="app-title-container" style="display: flex; align-items: center;" href="/">
        <img src="/assets/homescreen.png" alt="FlareDrive" style="height: 24px" />
        <h1 class="app-title" style="font-size: 20px;margin: 0 25px 0 8px; user-select: none;">FlareDrive</h1>
      </a>

      <div class="search-container" :class="{ 'search-expanded': isSearchExpanded }">
        <input
          type="search"
          v-model="search"
          @input="onSearchInput"
          @focus="onSearchFocus"
          @blur="onSearchBlur"
          aria-label="Search"
          placeholder="🍿 输入以全局搜索文件"
          class="search-input"
          ref="searchInput"
        />
      </div>

      <!-- 右侧控件容器 -->
      <div class="app-bar-right">
        <!-- 登录/用户状态按钮 -->
        <div class="user-status-container">
          <button class="user-status-button" @click="showLoginModal" :title="isLoggedIn ? '切换用户' : '登录'">
            <svg v-if="!isLoggedIn" viewBox="0 0 24 24" width="18" height="18" fill="#666">
              <path d="M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z" />
            </svg>
            <!-- 已登录状态的图标 -->
            <svg v-else viewBox="0 0 24 24" width="18" height="18" fill="#4CAF50">
              <path d="M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z" />
            </svg>
            <span class="user-status-text">{{ getTopUserStatusText() }}</span>
          </button>
        </div>

        <div class="menu-button">
        <button class="circle" @click="showMenu = true" style="display: flex; align-items: center;background-color: rgb(245, 245, 245);">
          <p style="
              white-space: nowrap;
              margin: 0 10px 0 0;
              font-size: 16px;
              font-family: '寒蝉半圆体', -apple-system, BlinkMacSystemFont, 'Segoe UI Adjusted',
    'Segoe UI', 'Liberation Sans', sans-serif;"
              class="menu-button-text">
            菜单
          </p>
          <svg t="1741761597964" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg"
            p-id="22027" width="24" height="24">
            <path
              d="M365 663.5v210.7c0 18.6-23.4 26.8-35 12.3L131.2 637.9c-13.3-16.6-1.5-41.1 19.8-41.1h80.7v-400c0-36.8 29.8-66.7 66.7-66.7 36.8 0 66.7 29.8 66.7 66.7v466.7h-0.1z m200-466.7h266.7c36.8 0 66.7 29.8 66.7 66.7s-29.8 66.7-66.7 66.7H565c-36.8 0-66.7-29.8-66.7-66.7 0-36.8 29.9-66.7 66.7-66.7z m0 266.7h200c36.8 0 66.7 29.8 66.7 66.6s-29.8 66.7-66.6 66.7H565c-36.8 0-66.7-29.8-66.7-66.7 0.1-36.8 29.9-66.6 66.7-66.6z m0 266.7h133.3c36.8 0 66.7 29.8 66.7 66.7 0 36.8-29.8 66.7-66.7 66.7H565c-36.8 0-66.7-29.8-66.7-66.7 0.1-36.9 29.9-66.7 66.7-66.7z"
              p-id="22028" fill="#2c2c2c"></path>
          </svg>
        </button>
        <Menu v-model="showMenu"
          :items="[
            { text: '按照名称排序A-Z' },
            { text: '按照大小递增排序' },
            { text: '按照大小递减排序' },
            { text: '粘贴文件到此目录', disabled: !clipboard || !canUpload }
          ]"
          @click="onMenuClick" />
        </div>
      </div>
    </div>
    <div class="file-list-container">
      <!-- 需要登录提示 -->
      <div v-if="needLogin" class="login-prompt">
        <div class="login-prompt-content">
          <svg viewBox="0 0 24 24" width="48" height="48" fill="#666">
            <path d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z" />
          </svg>
          <h3>当前目录需要登录才能查看</h3>
          <p>此目录需要特定权限才能访问，请点击顶部的登录按钮进行身份验证</p>
        </div>
      </div>

      <!-- 文件列表 -->
      <ul v-else class="file-list">
        <li v-if="cwd !== ''">
          <div tabindex="0" class="file-item" @click="cwd = cwd.replace(/[^\/]+\/$/, '')" @contextmenu.prevent>
            <div class="file-icon">
              <svg  viewBox="0 0 576 512"
                xmlns="http://www.w3.org/2000/svg" width="36" height="36">
                <path d="M384 480l48 0c11.4 0 21.9-6 27.6-15.9l112-192c5.8-9.9 5.8-22.1 .1-32.1S555.5 224 544 224l-400 0c-11.4 0-21.9 6-27.6 15.9L48 357.1 48 96c0-8.8 7.2-16 16-16l117.5 0c4.2 0 8.3 1.7 11.3 4.7l26.5 26.5c21 21 49.5 32.8 79.2 32.8L416 144c8.8 0 16 7.2 16 16l0 32 48 0 0-32c0-35.3-28.7-64-64-64L298.5 96c-17 0-33.3-6.7-45.3-18.7L226.7 50.7c-12-12-28.3-18.7-45.3-18.7L64 32C28.7 32 0 60.7 0 96L0 416c0 35.3 28.7 64 64 64l23.7 0L384 480z"/>
              </svg>
            </div>
            <div class="file-info-container"><span class="file-name">返回上级目录</span></div>

          </div>
        </li>
        <li v-for="folder in filteredFolders" :key="folder">
          <div tabindex="0" class="file-item" @click="cwd = folder" @contextmenu.prevent="
            showContextMenu = true;
          focusedItem = folder;
          ">
            <div class="file-icon">
              <svg  viewBox="0 0 576 512"
                xmlns="http://www.w3.org/2000/svg" width="36" height="36">
                <path d="M384 480l48 0c11.4 0 21.9-6 27.6-15.9l112-192c5.8-9.9 5.8-22.1 .1-32.1S555.5 224 544 224l-400 0c-11.4 0-21.9 6-27.6 15.9L48 357.1 48 96c0-8.8 7.2-16 16-16l117.5 0c4.2 0 8.3 1.7 11.3 4.7l26.5 26.5c21 21 49.5 32.8 79.2 32.8L416 144c8.8 0 16 7.2 16 16l0 32 48 0 0-32c0-35.3-28.7-64-64-64L298.5 96c-17 0-33.3-6.7-45.3-18.7L226.7 50.7c-12-12-28.3-18.7-45.3-18.7L64 32C28.7 32 0 60.7 0 96L0 416c0 35.3 28.7 64 64 64l23.7 0L384 480z"/>
              </svg>
            </div>
            <div class="file-info-container"><span class="file-name" v-text="folder.match(/.*?([^/]*)\/?$/)[1]"></span>
            </div>
            <div style="margin-right: 10px;margin-left: auto;" @click.stop="
              showContextMenu = true;
            focusedItem = folder;
            ">
              <svg t="1741761103305" class="icon" viewBox="0 0 1024 1024" version="1.1"
                xmlns="http://www.w3.org/2000/svg" p-id="6484" width="30" height="30">
                <path
                  d="M341.333333 533.333333a128 128 0 0 1 128 128v149.333334a128 128 0 0 1-128 128H192a128 128 0 0 1-128-128v-149.333334a128 128 0 0 1 128-128h149.333333z m469.333334 0a128 128 0 0 1 128 128v149.333334a128 128 0 0 1-128 128h-149.333334a128 128 0 0 1-128-128v-149.333334a128 128 0 0 1 128-128h149.333334z m-469.333334 64H192a64 64 0 0 0-63.893333 60.245334L128 661.333333v149.333334a64 64 0 0 0 60.245333 63.893333L192 874.666667h149.333333a64 64 0 0 0 63.893334-60.245334L405.333333 810.666667v-149.333334a64 64 0 0 0-60.245333-63.893333L341.333333 597.333333z m469.333334 0h-149.333334a64 64 0 0 0-63.893333 60.245334L597.333333 661.333333v149.333334a64 64 0 0 0 60.245334 63.893333L661.333333 874.666667h149.333334a64 64 0 0 0 63.893333-60.245334L874.666667 810.666667v-149.333334a64 64 0 0 0-60.245334-63.893333L810.666667 597.333333zM341.333333 64a128 128 0 0 1 128 128v149.333333a128 128 0 0 1-128 128H192a128 128 0 0 1-128-128V192a128 128 0 0 1 128-128h149.333333z m469.333334 0a128 128 0 0 1 128 128v149.333333a128 128 0 0 1-128 128h-149.333334a128 128 0 0 1-128-128V192a128 128 0 0 1 128-128h149.333334zM341.333333 128H192a64 64 0 0 0-63.893333 60.245333L128 192v149.333333a64 64 0 0 0 60.245333 63.893334L192 405.333333h149.333333a64 64 0 0 0 63.893334-60.245333L405.333333 341.333333V192a64 64 0 0 0-60.245333-63.893333L341.333333 128z m469.333334 0h-149.333334a64 64 0 0 0-63.893333 60.245333L597.333333 192v149.333333a64 64 0 0 0 60.245334 63.893334L661.333333 405.333333h149.333334a64 64 0 0 0 63.893333-60.245333L874.666667 341.333333V192a64 64 0 0 0-60.245334-63.893333L810.666667 128z"
                  fill="#2c2c2c" p-id="6485"></path>
              </svg>
            </div>
          </div>
        </li>
        <li v-for="file in filteredFiles" :key="file.key">
          <div @click="handleFileClick(file)" @contextmenu.prevent="
            showContextMenu = true;
          focusedItem = file;" class="file-item" style="position: relative;">
            <MimeIcon :content-type="file.httpMetadata?.contentType || 'application/octet-stream'" :thumbnail="file.customMetadata?.thumbnail
              ? `/raw/_$flaredrive$/thumbnails/${file.customMetadata.thumbnail}.png`
              : null
              " />
            <div class="file-info-container">
              <div class="file-name" v-text="file.key.split('/').pop()"></div>
              <div class="file-attr">
                <!-- 搜索结果显示完整路径 -->
                <span v-if="search && searchResults.length > 0" class="file-path" v-text="file.displayPath || file.key"></span>
                <span v-if="file.uploaded" v-text="new Date(file.uploaded).toLocaleString()"></span>
                <span v-if="file.size" v-text="formatSize(file.size)"></span>
              </div>
            </div>
            <div style="margin-right: 10px;margin-left: auto;" @click.stop="
              showContextMenu = true;
            focusedItem = file;
            ">
              <svg t="1741761103305" class="icon" viewBox="0 0 1024 1024" version="1.1"
                xmlns="http://www.w3.org/2000/svg" p-id="6484" width="30" height="30">
                <path
                  d="M341.333333 533.333333a128 128 0 0 1 128 128v149.333334a128 128 0 0 1-128 128H192a128 128 0 0 1-128-128v-149.333334a128 128 0 0 1 128-128h149.333333z m469.333334 0a128 128 0 0 1 128 128v149.333334a128 128 0 0 1-128 128h-149.333334a128 128 0 0 1-128-128v-149.333334a128 128 0 0 1 128-128h149.333334z m-469.333334 64H192a64 64 0 0 0-63.893333 60.245334L128 661.333333v149.333334a64 64 0 0 0 60.245333 63.893333L192 874.666667h149.333333a64 64 0 0 0 63.893334-60.245334L405.333333 810.666667v-149.333334a64 64 0 0 0-60.245333-63.893333L341.333333 597.333333z m469.333334 0h-149.333334a64 64 0 0 0-63.893333 60.245334L597.333333 661.333333v149.333334a64 64 0 0 0 60.245334 63.893333L661.333333 874.666667h149.333334a64 64 0 0 0 63.893333-60.245334L874.666667 810.666667v-149.333334a64 64 0 0 0-60.245334-63.893333L810.666667 597.333333zM341.333333 64a128 128 0 0 1 128 128v149.333333a128 128 0 0 1-128 128H192a128 128 0 0 1-128-128V192a128 128 0 0 1 128-128h149.333333z m469.333334 0a128 128 0 0 1 128 128v149.333333a128 128 0 0 1-128 128h-149.333334a128 128 0 0 1-128-128V192a128 128 0 0 1 128-128h149.333334zM341.333333 128H192a64 64 0 0 0-63.893333 60.245333L128 192v149.333333a64 64 0 0 0 60.245333 63.893334L192 405.333333h149.333333a64 64 0 0 0 63.893334-60.245333L405.333333 341.333333V192a64 64 0 0 0-60.245333-63.893333L341.333333 128z m469.333334 0h-149.333334a64 64 0 0 0-63.893333 60.245333L597.333333 192v149.333333a64 64 0 0 0 60.245334 63.893334L661.333333 405.333333h149.333334a64 64 0 0 0 63.893333-60.245333L874.666667 341.333333V192a64 64 0 0 0-60.245334-63.893333L810.666667 128z"
                  fill="#2c2c2c" p-id="6485"></path>
              </svg>
            </div>
          </div>
        </li>
      </ul>

      <div v-if="loading && !needLogin" style="margin: 20px 0; text-align: center">
        <span style="font-size: 20px;">加载中...</span>
      </div>
      <div v-else-if="!needLogin && !filteredFiles.length && !filteredFolders.length" style="margin: 20px 0; text-align: center">
        <span style="font-size: 20px;">没有文件</span>
      </div>
    </div>
    <Dialog v-model="showContextMenu">
      <div
        style="height: 50px;display: flex; justify-content: center; align-items: center; padding:10px; background: #ddd; margin: 0 0 10px 0; border-radius: 8px;">
        <div v-text="focusedItem.key || focusedItem" class="contextmenu-filename" @click.stop.prevent
          style="height:20px;width: 100%; max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"></div>
      </div>
      <ul v-if="typeof focusedItem === 'string'" class="contextmenu-list">
        <li>
          <button @click="copyLink(`/?p=${encodeURIComponent(focusedItem)}`)">
            <span>复制链接</span>
          </button>
        </li>
        <li>
          <button @click="moveFile(focusedItem + '_$folder$')">
            <span>移动</span>
          </button>
        </li>
        <li v-if="clipboard">
          <button @click="pasteFile()">
            <span>粘贴</span>
          </button>
        </li>
        <li>
          <button style="color: red" @click="removeFile(focusedItem + '_$folder$')">
            <span>删除</span>
          </button>
        </li>
      </ul>
      <ul v-else class="contextmenu-list">
        <li>
          <button @click="renameFile(focusedItem.key)">
            <span>重命名</span>
          </button>
        </li>
        <li>
          <a :href="`/raw/${focusedItem.key}`" target="_blank" download>
            <span>下载</span>
          </a>
        </li>
        <li>
          <button @click="clipboard = focusedItem.key">
            <span>复制</span>
          </button>
        </li>
        <li>
          <button @click="moveFile(focusedItem.key)">
            <span>移动</span>
          </button>
        </li>
        <li>
          <button @click="copyLink(`/raw/${focusedItem.key}`)">
            <span>复制链接</span>
          </button>
        </li>
        <li v-if="clipboard">
          <button @click="pasteFile()">
            <span>粘贴</span>
          </button>
        </li>
        <li>
          <button style="color: red" @click="removeFile(focusedItem.key)">
            <span>删除</span>
          </button>
        </li>
      </ul>
    </Dialog>

    <!-- 媒体预览组件 -->
    <MediaPreview
      :show="showMediaPreview"
      :mediaList="previewMediaList"
      :initialIndex="previewInitialIndex"
      @close="closeMediaPreview"
    />

    <!-- 自定义输入对话框 -->
    <Dialog v-model="showInputDialog">
      <div style="padding: 20px;">
        <h3 v-text="inputDialog.title" style="margin: 0 0 15px 0;"></h3>
        <input
          v-model="inputDialog.value"
          :placeholder="inputDialog.placeholder"
          style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; margin-bottom: 15px;"
          @keyup.enter="confirmInput"
          ref="inputField"
        />
        <div style="display: flex; gap: 10px; justify-content: flex-end;">
          <button @click="cancelInput" style="padding: 8px 16px; border: 1px solid #ddd; background: white; border-radius: 4px;">取消</button>
          <button @click="confirmInput" style="padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px;">确定</button>
        </div>
      </div>
    </Dialog>

    <!-- 目录选择对话框 -->
    <Dialog v-model="showFolderDialog">
      <div style="padding: 20px;">
        <h3 v-text="folderDialog.title" style="margin: 0 0 15px 0;"></h3>
        <div style="max-height: 300px; overflow-y: auto; border: 1px solid #ddd; border-radius: 4px; margin-bottom: 15px;">
          <div
            v-for="(folder, index) in folderDialog.folders"
            :key="index"
            @click="selectFolder(folder)"
            :class="{ 'selected': folderDialog.selectedFolder === folder.value }"
            style="padding: 10px; cursor: pointer; border-bottom: 1px solid #eee;"
            :style="{
              backgroundColor: folderDialog.selectedFolder === folder.value ? '#e3f2fd' : 'transparent',
              fontWeight: folderDialog.selectedFolder === folder.value ? 'bold' : 'normal'
            }"
          >
            <span v-text="folder.display"></span>
          </div>
        </div>
        <div style="display: flex; gap: 10px; justify-content: flex-end;">
          <button @click="cancelFolderSelection" style="padding: 8px 16px; border: 1px solid #ddd; background: white; border-radius: 4px;">取消</button>
          <button @click="confirmFolderSelection" :disabled="!folderDialog.selectedFolder" style="padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; opacity: folderDialog.selectedFolder ? 1 : 0.5;">确定</button>
        </div>
      </div>
    </Dialog>

    <!-- 浮动粘贴按钮 -->
    <div
      v-if="clipboard && canUpload"
      class="floating-paste-button"
      :class="{ 'mobile': isMobile }"
      :style="{ left: pasteButtonPosition.x + 'px', top: pasteButtonPosition.y + 'px' }"
      @mousedown="startDragPasteButton"
      @touchstart="startDragPasteButton"
      @click="handlePasteButtonClick"
      @touchend="handleTouchEnd"
    >
      <div class="paste-button-content">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
        </svg>
        <span v-if="!isMobile">粘贴</span>
      </div>
      <div class="paste-file-info" v-if="!isMobile">
        {{ clipboard.split('/').pop() }}
      </div>
    </div>

    <div style="flex:1"></div>
    <Footer />
  </div>
</template>

<script>
import {
  generateThumbnail,
  blobDigest,
  multipartUpload,
  SIZE_LIMIT,
} from "/assets/main.mjs";
import Dialog from "./Dialog.vue";
import Menu from "./Menu.vue";
import MimeIcon from "./MimeIcon.vue";
import UploadPopup from "./UploadPopup.vue";
import Footer from "./Footer.vue";
import MediaPreview from "./MediaPreview.vue";

export default {
  data: () => ({
    cwd: new URL(window.location).searchParams.get("p") || "",
    files: [],
    folders: [],
    clipboard: null,
    focusedItem: null,
    loading: false,
    order: null,
    search: "",
    searchResults: [], // 全局搜索结果
    isSearching: false, // 搜索状态
    searchTimeout: null, // 搜索防抖定时器
    isSearchExpanded: false, // 搜索框是否展开
    showContextMenu: false,
    showMenu: false,
    showUploadPopup: false,
    uploadProgress: null,
    uploadQueue: [],
    backgroundImageUrl: "/assets/bg-light.webp",
    needLogin: false,
    isGuest: true, // 默认为游客状态
    isLoggedIn: false,
    currentUser: null, // 当前用户信息
    // 模态框相关
    showModal: false,
    loginForm: {
      username: '',
      password: ''
    },
    loginLoading: false,
    loginError: '',
    // 媒体预览相关
    showMediaPreview: false,
    previewMediaList: [],
    previewInitialIndex: 0,
    // 自定义对话框相关
    showInputDialog: false,
    inputDialog: {
      title: '',
      placeholder: '',
      value: '',
      resolve: null,
      reject: null
    },
    showFolderDialog: false,
    folderDialog: {
      title: '',
      folders: [],
      selectedFolder: null,
      resolve: null,
      reject: null
    },
    // 浮动粘贴按钮相关
    pasteButtonPosition: { x: 0, y: 0 },
    isDraggingPasteButton: false,
    dragOffset: { x: 0, y: 0 },
    dragStartTime: 0,
    hasMoved: false
  }),

  computed: {
    filteredFiles() {
      // 如果有搜索词且有搜索结果，显示搜索结果
      if (this.search && this.searchResults.length > 0) {
        return this.searchResults.filter(item => !item.isFolder);
      }

      // 否则显示当前目录的文件
      let files = this.files;
      if (this.search && !this.isSearching) {
        // 本地搜索作为备选
        files = files.filter((file) =>
          file.key.split("/").pop().toLowerCase().includes(this.search.toLowerCase())
        );
      }
      return files;
    },

    filteredFolders() {
      // 如果有搜索词且有搜索结果，显示搜索结果中的文件夹
      if (this.search && this.searchResults.length > 0) {
        return this.searchResults.filter(item => item.isFolder).map(item => item.key);
      }

      // 否则显示当前目录的文件夹
      let folders = this.folders;
      if (this.search && !this.isSearching) {
        // 本地搜索作为备选
        folders = folders.filter((folder) =>
          folder.toLowerCase().includes(this.search.toLowerCase())
        );
      }
      return folders;
    },

    // 检查是否可以上传（登录用户或有上传权限的游客）
    canUpload() {
      // 游客不允许上传
      if (this.isGuest) {
        return false;
      }
      // 只读用户不允许上传
      if (this.isReadOnlyUser) {
        return false;
      }
      // 已登录用户可以上传
      return this.isLoggedIn;
    },

    // 检查是否是只读用户
    isReadOnlyUser() {
      return this.currentUser && this.currentUser.isReadOnly;
    },

    // 检测是否为移动端
    isMobile() {
      return window.innerWidth <= 768;
    },
  },

  mounted() {
    // 检查是否有保存的认证信息
    const savedCredentials = localStorage.getItem('authCredentials');
    if (savedCredentials) {
      this.setAuthHeader(savedCredentials);
      // 恢复用户信息
      this.restoreUserInfo();
    }
    this.fetchFiles();
    this.initPasteButtonPosition();
  },

  beforeUnmount() {
    // 清理事件监听器
    document.removeEventListener('mousemove', this.dragPasteButton);
    document.removeEventListener('mouseup', this.stopDragPasteButton);
    document.removeEventListener('touchmove', this.dragPasteButton);
    document.removeEventListener('touchend', this.stopDragPasteButton);
  },

  methods: {
    // 搜索输入处理
    onSearchInput() {
      // 清除之前的定时器
      if (this.searchTimeout) {
        clearTimeout(this.searchTimeout);
      }

      // 如果搜索框为空，清空结果并收回搜索框
      if (!this.search.trim()) {
        this.searchResults = [];
        this.isSearching = false;
        this.isSearchExpanded = false;
        // 恢复页面滚动
        document.body.style.overflow = '';
        document.body.style.overflowX = '';
        document.documentElement.style.overflowX = '';
        return;
      }

      // 设置新的定时器，防抖处理
      this.searchTimeout = setTimeout(() => {
        this.performSearch();
      }, 300);
    },

    // 搜索框获得焦点
    onSearchFocus() {
      this.isSearchExpanded = true;
      // 防止页面滚动（仅在移动端）
      if (window.innerWidth <= 768) {
        document.body.style.overflow = 'hidden';
        document.body.style.overflowX = 'hidden'; // 强制防止水平滚动
        document.documentElement.style.overflowX = 'hidden'; // 也设置html元素
      }
    },

    // 搜索框失去焦点
    onSearchBlur() {
      // 延迟收回，避免点击搜索结果时立即收回
      setTimeout(() => {
        if (!this.search.trim()) {
          this.isSearchExpanded = false;
          // 恢复页面滚动
          document.body.style.overflow = '';
          document.body.style.overflowX = '';
          document.documentElement.style.overflowX = '';
        }
      }, 200);
    },

    // 执行搜索
    async performSearch() {
      if (!this.search.trim()) return;

      this.isSearching = true;
      try {
        // 这里可以实现实际的搜索逻辑
        // 暂时使用本地过滤作为示例
        this.searchResults = this.files.filter(file =>
          file.key.toLowerCase().includes(this.search.toLowerCase())
        );
      } catch (error) {
        console.error('搜索失败:', error);
      } finally {
        this.isSearching = false;
      }
    },

    copyLink(link) {
      const url = new URL(link, window.location.origin);
      navigator.clipboard.writeText(url.toString());
    },

    async copyPaste(source, target) {
      const uploadUrl = `/api/write/items/${target}`;

      // 准备请求头
      const headers = {
        "x-amz-copy-source": encodeURIComponent(source),
        "Content-Type": "application/octet-stream"
      };
      const savedCredentials = localStorage.getItem('authCredentials');
      if (savedCredentials) {
        headers['Authorization'] = `Basic ${savedCredentials}`;
      }

      try {
        const response = await fetch(uploadUrl, {
          method: 'PUT',
          headers: headers,
          body: ""
        });

        // 检查响应状态
        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            // 抛出特殊的权限错误，让调用方处理
            const authError = new Error('需要登录或权限不足');
            authError.isAuthError = true;
            authError.status = response.status;
            throw authError;
          }
          // 其他HTTP错误
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      } catch (error) {
        // 如果已经是我们的权限错误，直接抛出
        if (error.isAuthError) {
          throw error;
        }
        // 网络错误或其他错误
        throw new Error(`复制粘贴失败: ${error.message}`);
      }
    },

    // 删除文件的统一方法
    async deleteFile(key) {
      const deleteUrl = `/api/write/items/${key}`;

      // 准备请求头
      const headers = {};
      const savedCredentials = localStorage.getItem('authCredentials');
      if (savedCredentials) {
        headers['Authorization'] = `Basic ${savedCredentials}`;
      }

      try {
        const response = await fetch(deleteUrl, {
          method: 'DELETE',
          headers: headers
        });

        // 检查响应状态
        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            // 抛出特殊的权限错误，让调用方处理
            const authError = new Error('需要登录或权限不足');
            authError.isAuthError = true;
            authError.status = response.status;
            throw authError;
          }
          // 其他HTTP错误
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      } catch (error) {
        // 如果已经是我们的权限错误，直接抛出
        if (error.isAuthError) {
          throw error;
        }
        // 网络错误或其他错误
        throw new Error(`删除文件失败: ${error.message}`);
      }
    },

    async createFolder() {
      try {
        const folderName = await this.showInputPrompt("创建文件夹", "请输入文件夹名称");
        if (!folderName) return;
        this.showUploadPopup = false;
        const uploadUrl = `/api/write/items/${this.cwd}${folderName}/_$folder$`;
        await axios.put(uploadUrl, "");
        this.fetchFiles();
      } catch (error) {
        if (error === null) return; // 用户取消
        fetch("/api/write/")
          .then((value) => {
            if (value.redirected) window.location.href = value.url;
          })
          .catch(() => { });
        console.log(`Create folder failed`);
      }
    },

    fetchFiles() {
      this.files = [];
      this.folders = [];
      this.loading = true;
      this.needLogin = false;

      // 准备请求头
      const headers = {};
      const savedCredentials = localStorage.getItem('authCredentials');
      if (savedCredentials) {
        headers['Authorization'] = `Basic ${savedCredentials}`;
      }

      fetch(`/api/children/${this.cwd}`, { headers })
        .then((res) => res.json())
        .then((data) => {
          if (data.needLogin) {
            // 需要登录 - 静默处理，不弹出登录框
            this.needLogin = true;
            this.isLoggedIn = false;
            this.isGuest = true;
            this.loading = false;
            return;
          }

          this.needLogin = false;
          this.files = data.value || [];
          this.folders = data.folders || [];
          this.isGuest = data.isGuest || false;
          this.isLoggedIn = !this.isGuest;

          if (this.order) {
            this.files.sort((a, b) => {
              if (this.order === "size") {
                return b.size - a.size;
              }
            });
          }
          this.loading = false;
        })
        .catch((error) => {
          console.error('获取文件列表失败:', error);
          this.loading = false;
        });
    },

    formatSize(size) {
      const units = ["B", "KB", "MB", "GB", "TB"];
      let i = 0;
      while (size >= 1024) {
        size /= 1024;
        i++;
      }
      return `${size.toFixed(1)} ${units[i]}`;
    },

    onDrop(ev) {
      // 检查是否有上传权限
      if (!this.canUpload) {
        if (this.needLogin) {
          this.triggerLogin();
        }
        return;
      }

      let files;
      if (ev.dataTransfer.items) {
        files = [...ev.dataTransfer.items]
          .filter((item) => item.kind === "file")
          .map((item) => item.getAsFile());
      } else files = ev.dataTransfer.files;
      this.uploadFiles(files);
    },

    // 显示登录模态框
    showLoginModal() {
      this.showModal = true;
      this.loginError = '';
      this.loginForm.username = '';
      this.loginForm.password = '';
    },

    // 关闭登录模态框
    closeModal() {
      this.showModal = false;
      this.loginError = '';
      this.loginLoading = false;
    },

    // 处理登录
    async handleLogin() {
      this.loginLoading = true;
      this.loginError = '';

      try {
        // 创建Basic Auth头
        const credentials = btoa(`${this.loginForm.username}:${this.loginForm.password}`);

        // 使用专门的登录端点验证
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache'
          }
        });

        const data = await response.json();

        if (data.success) {
          // 登录成功，设置认证头到全局并保存用户信息
          this.setAuthHeader(credentials, data.user);
          this.currentUser = data.user; // 保存用户信息
          this.isLoggedIn = true;
          this.isGuest = false;
          this.closeModal();

          // 登录成功后刷新当前目录，显示用户有权限的内容
          // 不自动跳转，让用户在根目录看到他们可以访问的目录
          setTimeout(() => {
            this.fetchFiles();
          }, 100);
        } else {
          this.loginError = data.message || '登录失败';
        }
      } catch (error) {
        this.loginError = '登录失败，请重试';
        console.error('登录错误:', error);
      } finally {
        this.loginLoading = false;
      }
    },

    // 设置认证头
    setAuthHeader(credentials, userInfo = null) {
      // 将认证信息存储到localStorage，以便后续请求使用
      localStorage.setItem('authCredentials', credentials);

      // 如果提供了用户信息，也保存到localStorage
      if (userInfo) {
        localStorage.setItem('currentUser', JSON.stringify(userInfo));
      }

      // 设置默认的axios请求头
      if (window.axios) {
        window.axios.defaults.headers.common['Authorization'] = `Basic ${credentials}`;
      }
    },

    // 恢复用户信息
    restoreUserInfo() {
      try {
        const savedUserInfo = localStorage.getItem('currentUser');
        if (savedUserInfo) {
          this.currentUser = JSON.parse(savedUserInfo);
          this.isLoggedIn = true;
          this.isGuest = false;
        }
      } catch (error) {
        console.error('恢复用户信息失败:', error);
        // 出错时清除认证信息
        this.clearAuthHeader();
      }
    },

    // 获取用户状态文本
    getUserStatusText() {
      if (this.isGuest) {
        return '游客模式';
      } else if (this.currentUser) {
        const username = this.currentUser.username;
        const readOnlyText = this.currentUser.isReadOnly ? ' (只读)' : '';
        return `${username} 已登录${readOnlyText}`;
      } else {
        return '已登录';
      }
    },

    // 获取顶部用户状态文本（简化版）
    getTopUserStatusText() {
      if (!this.isLoggedIn) {
        return '登录';
      } else if (this.currentUser) {
        const username = this.currentUser.username;
        const readOnlyText = this.currentUser.isReadOnly ? ' (只读)' : '';
        return `${username}${readOnlyText}`;
      } else {
        return '已登录';
      }
    },

    // 获取用户描述文本
    getUserDescText() {
      if (this.isGuest) {
        return '只能查看文件';
      } else if (this.isReadOnlyUser) {
        return '只能查看文件，无法上传或修改';
      } else {
        return '可以上传和管理文件';
      }
    },

    // 清除认证头
    clearAuthHeader() {
      localStorage.removeItem('authCredentials');
      localStorage.removeItem('currentUser');
      if (window.axios) {
        delete window.axios.defaults.headers.common['Authorization'];
      }
    },

    // 切换用户
    switchUser() {
      this.isLoggedIn = false;
      this.isGuest = true;
      this.needLogin = false;
      this.loginForm.username = '';
      this.loginForm.password = '';
      this.loginError = '';
      // 不关闭模态框，直接切换到登录表单
    },

    // 退出登录
    logout() {
      this.clearAuthHeader(); // 清除认证信息
      this.currentUser = null; // 清除用户信息
      this.isLoggedIn = false;
      this.isGuest = true;
      this.needLogin = false;
      this.closeModal();
      this.fetchFiles(); // 刷新文件列表，显示游客视图
    },

    // 触发登录（保留原方法用于拖拽上传时的登录）
    triggerLogin() {
      this.showLoginModal();
    },

    // 自定义输入对话框
    showInputPrompt(title, placeholder = '', defaultValue = '') {
      return new Promise((resolve, reject) => {
        this.inputDialog = {
          title,
          placeholder,
          value: defaultValue,
          resolve,
          reject
        };
        this.showInputDialog = true;
        // 等待DOM更新后聚焦输入框
        this.$nextTick(() => {
          if (this.$refs.inputField) {
            this.$refs.inputField.focus();
          }
        });
      });
    },

    confirmInput() {
      if (this.inputDialog.resolve) {
        this.inputDialog.resolve(this.inputDialog.value);
      }
      this.showInputDialog = false;
    },

    cancelInput() {
      if (this.inputDialog.reject) {
        this.inputDialog.reject(null);
      }
      this.showInputDialog = false;
    },

    // 自定义文件夹选择对话框
    showFolderSelector(title, folders) {
      return new Promise((resolve, reject) => {
        this.folderDialog = {
          title,
          folders,
          selectedFolder: null,
          resolve,
          reject
        };
        this.showFolderDialog = true;
      });
    },

    selectFolder(folder) {
      this.folderDialog.selectedFolder = folder.value;
    },

    confirmFolderSelection() {
      if (this.folderDialog.resolve && this.folderDialog.selectedFolder !== null) {
        this.folderDialog.resolve(this.folderDialog.selectedFolder);
      }
      this.showFolderDialog = false;
    },

    cancelFolderSelection() {
      if (this.folderDialog.reject) {
        this.folderDialog.reject(null);
      }
      this.showFolderDialog = false;
    },

    // 初始化粘贴按钮位置
    initPasteButtonPosition() {
      if (this.isMobile) {
        // 移动端：右下角，避开返回按钮区域
        this.pasteButtonPosition.x = window.innerWidth - 80;
        this.pasteButtonPosition.y = window.innerHeight - 150;
      } else {
        // 桌面端：左侧中间
        this.pasteButtonPosition.x = 20;
        this.pasteButtonPosition.y = window.innerHeight / 2 - 50;
      }
    },

    // 浮动粘贴按钮相关方法
    startDragPasteButton(event) {
      this.dragStartTime = Date.now();
      this.hasMoved = false;

      // 支持触摸事件
      const clientX = event.touches ? event.touches[0].clientX : event.clientX;
      const clientY = event.touches ? event.touches[0].clientY : event.clientY;

      this.dragOffset.x = clientX - this.pasteButtonPosition.x;
      this.dragOffset.y = clientY - this.pasteButtonPosition.y;

      // 添加鼠标和触摸事件监听
      document.addEventListener('mousemove', this.dragPasteButton);
      document.addEventListener('mouseup', this.stopDragPasteButton);
      document.addEventListener('touchmove', this.dragPasteButton);
      document.addEventListener('touchend', this.stopDragPasteButton);

      // 阻止默认行为，但不阻止点击事件
      if (event.type === 'touchstart') {
        event.preventDefault();
      }
    },

    dragPasteButton(event) {
      // 标记已移动
      this.hasMoved = true;
      this.isDraggingPasteButton = true;

      // 支持触摸事件
      const clientX = event.touches ? event.touches[0].clientX : event.clientX;
      const clientY = event.touches ? event.touches[0].clientY : event.clientY;

      this.pasteButtonPosition.x = clientX - this.dragOffset.x;
      this.pasteButtonPosition.y = clientY - this.dragOffset.y;

      // 限制在视窗范围内
      const buttonWidth = this.isMobile ? 50 : 120;
      const buttonHeight = this.isMobile ? 50 : 60;
      this.pasteButtonPosition.x = Math.max(0, Math.min(window.innerWidth - buttonWidth, this.pasteButtonPosition.x));
      this.pasteButtonPosition.y = Math.max(0, Math.min(window.innerHeight - buttonHeight, this.pasteButtonPosition.y));

      event.preventDefault();
    },

    stopDragPasteButton() {
      // 移除所有事件监听器
      document.removeEventListener('mousemove', this.dragPasteButton);
      document.removeEventListener('mouseup', this.stopDragPasteButton);
      document.removeEventListener('touchmove', this.dragPasteButton);
      document.removeEventListener('touchend', this.stopDragPasteButton);

      // 延迟重置状态
      setTimeout(() => {
        this.isDraggingPasteButton = false;
        this.hasMoved = false;
      }, 100);
    },

    handleTouchEnd(event) {
      // 如果没有移动且时间很短，认为是点击
      const touchDuration = Date.now() - this.dragStartTime;
      if (!this.hasMoved && touchDuration < 300) {
        this.handlePasteButtonClick();
      }
      event.preventDefault();
    },

    async handlePasteButtonClick() {
      // 如果正在拖拽或刚刚移动过，不执行粘贴
      if (this.isDraggingPasteButton || this.hasMoved) {
        return;
      }

      try {
        await this.pasteFile();
      } catch (error) {
        console.error('粘贴文件失败:', error);
        alert('粘贴文件失败: ' + (error.message || error));
      }
    },

    onMenuClick(text) {
      switch (text) {
        case "按照名称排序A-Z":
          this.order = null;
          break;
        case "按照大小递增排序":
          this.order = "大小↑";
          break;
        case "按照大小递减排序":
          this.order = "大小↓";
          break;
        case "粘贴文件到此目录":
          this.pasteFile();
          return; // 粘贴操作不需要排序
      }
      this.files.sort((a, b) => {
        if (this.order === "大小↑") {
          return a.size - b.size;
        } else if (this.order === "大小↓") {
          return b.size - a.size;
        } else {
          return a.key.localeCompare(b.key);
        }
      });
    },

    onUploadClicked(fileElement) {
      if (!fileElement.value) return;
      this.uploadFiles(fileElement.files);
      this.showUploadPopup = false;
      fileElement.value = null;
    },

    preview(filePath) {
      window.open(filePath);
    },

    // 处理文件点击（区分搜索结果和普通文件）
    handleFileClick(file) {
      // 检查是否是媒体文件
      const imageTypes = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'];
      const videoTypes = ['mp4', 'webm', 'ogv', 'avi', 'mov', 'wmv'];
      const ext = file.key?.split('.').pop()?.toLowerCase();
      const isImageFile = imageTypes.includes(ext);
      const isVideoFile = videoTypes.includes(ext);
      const isMediaFile = isImageFile || isVideoFile;

      if (isMediaFile) {
        // 媒体文件：打开预览
        this.openMediaPreview(file);
      } else if (this.search && this.searchResults.length > 0) {
        // 搜索结果中的非媒体文件：跳转到文件所在目录
        const filePath = file.displayPath || file.key;
        const directory = filePath.substring(0, filePath.lastIndexOf('/') + 1);
        this.search = ''; // 清除搜索
        this.searchResults = [];
        this.cwd = directory;
      } else {
        // 普通非媒体文件：直接预览/下载
        this.preview(`/raw/${file.key}`);
      }
    },

    // 打开媒体预览
    openMediaPreview(clickedFile) {
      // 确定点击文件的类型
      const imageTypes = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'];
      const videoTypes = ['mp4', 'webm', 'ogv', 'avi', 'mov', 'wmv'];
      const clickedExt = clickedFile.key?.split('.').pop()?.toLowerCase();
      const isClickedImage = imageTypes.includes(clickedExt);
      const isClickedVideo = videoTypes.includes(clickedExt);

      // 确定媒体文件列表和初始索引
      let mediaList = [];
      let initialIndex = 0;

      if (this.search && this.searchResults.length > 0) {
        // 搜索结果中的同类型媒体文件
        mediaList = this.searchResults.filter(file => {
          if (file.isFolder) return false;
          const ext = file.key?.split('.').pop()?.toLowerCase();
          if (isClickedImage) {
            return imageTypes.includes(ext);
          } else if (isClickedVideo) {
            return videoTypes.includes(ext);
          }
          return false;
        });
      } else {
        // 当前目录中的同类型媒体文件
        mediaList = this.filteredFiles.filter(file => {
          const ext = file.key?.split('.').pop()?.toLowerCase();
          if (isClickedImage) {
            return imageTypes.includes(ext);
          } else if (isClickedVideo) {
            return videoTypes.includes(ext);
          }
          return false;
        });
      }

      // 为每个媒体文件添加预览URL
      mediaList = mediaList.map(file => ({
        ...file,
        url: `/raw/${file.key}`,
        name: file.key.split('/').pop()
      }));

      // 找到点击文件的索引
      initialIndex = mediaList.findIndex(file => file.key === clickedFile.key);
      if (initialIndex === -1) initialIndex = 0;

      // 设置预览数据
      this.previewMediaList = mediaList;
      this.previewInitialIndex = initialIndex;
      this.showMediaPreview = true;
    },

    // 关闭媒体预览
    closeMediaPreview() {
      this.showMediaPreview = false;
      this.previewMediaList = [];
      this.previewInitialIndex = 0;
    },

    async pasteFile() {
      if (!this.clipboard) return;
      try {
        const defaultName = this.clipboard.split("/").pop();
        let newName = await this.showInputPrompt("粘贴文件", "重命名为:", defaultName);
        if (newName === null || newName === undefined) return;
        if (newName === "") newName = defaultName;
        await this.copyPaste(this.clipboard, `${this.cwd}${newName}`);
        this.fetchFiles();
      } catch (error) {
        if (error === null) return; // 用户取消

        // 检查是否是权限错误
        if (error.isAuthError) {
          // 显示友好的权限提示，并提供登录选项
          this.showPermissionDialog();
          return;
        }

        console.error('粘贴文件失败:', error);
        alert('粘贴文件失败: ' + (error.message || '未知错误'));
      }
    },

    // 显示权限对话框
    showPermissionDialog(operation = '粘贴文件') {
      const message = this.isLoggedIn
        ? `您没有权限在此目录${operation}。可能需要更高级别的权限或者此目录为只读。`
        : `您需要登录才能在此目录${operation}。`;

      const action = this.isLoggedIn ? '确定' : '立即登录';

      if (confirm(`${message}\n\n点击"${action}"${this.isLoggedIn ? '' : '进行身份验证'}`)) {
        if (!this.isLoggedIn) {
          this.showLoginModal();
        }
      }
    },

    async processUploadQueue() {
      if (!this.uploadQueue.length) {
        this.fetchFiles();
        this.uploadProgress = null;
        return;
      }

      /** @type File **/
      const { basedir, file } = this.uploadQueue.pop(0);
      let thumbnailDigest = null;

      if (file.type.startsWith("image/") || file.type === "video/mp4") {
        try {
          const thumbnailBlob = await generateThumbnail(file);
          const digestHex = await blobDigest(thumbnailBlob);

          const thumbnailUploadUrl = `/api/write/items/_$flaredrive$/thumbnails/${digestHex}.png`;
          try {
            await axios.put(thumbnailUploadUrl, thumbnailBlob);
            thumbnailDigest = digestHex;
          } catch (error) {
            fetch("/api/write/")
              .then((value) => {
                if (value.redirected) window.location.href = value.url;
              })
              .catch(() => { });
            console.log(`Upload ${digestHex}.png failed`);
          }
        } catch (error) {
          console.log(`Generate thumbnail failed`);
        }
      }

      try {
        const uploadUrl = `/api/write/items/${basedir}${file.name}`;
        const headers = {};
        const onUploadProgress = (progressEvent) => {
          var percentCompleted =
            (progressEvent.loaded * 100) / progressEvent.total;
          this.uploadProgress = percentCompleted;
        };
        if (thumbnailDigest) headers["fd-thumbnail"] = thumbnailDigest;
        if (file.size >= SIZE_LIMIT) {
          await multipartUpload(`${basedir}${file.name}`, file, {
            headers,
            onUploadProgress,
          });
        } else {
          await axios.put(uploadUrl, file, { headers, onUploadProgress });
        }
      } catch (error) {
        fetch("/api/write/")
          .then((value) => {
            if (value.redirected) window.location.href = value.url;
          })
          .catch(() => { });
        console.log(`Upload ${file.name} failed`, error);
      }
      setTimeout(this.processUploadQueue);
    },

    async removeFile(key) {
      if (!window.confirm(`确定要删除 ${key} 吗？`)) return;
      try {
        await this.deleteFile(key);
        this.fetchFiles();
      } catch (error) {
        // 检查是否是权限错误
        if (error.isAuthError) {
          this.showPermissionDialog('删除文件');
          return;
        }
        console.error('删除失败:', error);
        alert('删除失败: ' + (error.message || '未知错误'));
      }
    },

    async renameFile(key) {
      try {
        const currentName = key.split('/').pop();
        const newName = await this.showInputPrompt("重命名文件", "新名称:", currentName);
        if (!newName) return;
        await this.copyPaste(key, `${this.cwd}${newName}`);
        await this.deleteFile(key);
        this.fetchFiles();
      } catch (error) {
        if (error === null) return; // 用户取消

        // 检查是否是权限错误
        if (error.isAuthError) {
          this.showPermissionDialog('重命名文件');
          return;
        }

        console.error('重命名失败:', error);
        alert('重命名失败: ' + (error.message || '未知错误'));
      }
    },

    async moveFile(key) {
      try {
        // 获取用户有权限的目录列表
        const accessibleFolders = await this.getAccessibleFolders();

        if (accessibleFolders.length === 0) {
          alert('没有可用的目标目录，您可能没有足够的权限');
          return;
        }

        // 构建选择列表
        const folderOptions = accessibleFolders.map(folder => {
          const displayName = folder.path === '' ? '根目录' :
            folder.path === this.cwd ? '当前目录' :
              folder.displayName;
          return {
            display: displayName,
            value: folder.path
          };
        });

        // 使用自定义文件夹选择器
        const targetPath = await this.showFolderSelector('选择目标目录', folderOptions);
        if (targetPath === null || targetPath === undefined) return; // 用户取消

        // 获取文件名
        const fileName = key.split('/').pop();
        // 如果是文件夹,需要移除_$folder$后缀
        const finalFileName = fileName.endsWith('_$folder$') ? fileName.slice(0, -9) : fileName;

        // 修复：正确处理目标路径，避免双斜杠
        const normalizedPath = targetPath === '' ? '' : (targetPath.endsWith('/') ? targetPath : targetPath + '/');

        // 如果是目录（以_$folder$结尾），则需要移动整个目录内容
        if (key.endsWith('_$folder$')) {
          // 获取源目录的基础路径（移除_$folder$后缀）
          const sourceBasePath = key.slice(0, -9);
          // 获取目标目录的基础路径，修复根目录的情况
          const targetBasePath = normalizedPath + finalFileName + '/';

          // 递归获取所有子文件和子目录
          const allItems = await this.getAllItems(sourceBasePath);

          // 显示进度提示
          const totalItems = allItems.length;
          let processedItems = 0;

          // 移动所有项目
          for (const item of allItems) {
            const relativePath = item.key.substring(sourceBasePath.length);
            const newPath = targetBasePath + relativePath;

            try {
              // 复制到新位置
              await this.copyPaste(item.key, newPath);
              // 删除原位置
              await this.deleteFile(item.key);

              // 更新进度
              processedItems++;
              this.uploadProgress = (processedItems / totalItems) * 100;
            } catch (error) {
              console.error(`移动 ${item.key} 失败:`, error);
            }
          }

          // 移动目录标记
          const targetFolderPath = targetBasePath.slice(0, -1) + '_$folder$';
          await this.copyPaste(key, targetFolderPath);
          await this.deleteFile(key);

          // 清除进度
          this.uploadProgress = null;
        } else {
          // 单文件移动逻辑，修复根目录的情况
          const targetFilePath = normalizedPath + finalFileName;
          await this.copyPaste(key, targetFilePath);
          await this.deleteFile(key);
        }

        // 刷新文件列表
        this.fetchFiles();
      } catch (error) {
        if (error === null) return; // 用户取消

        // 检查是否是权限错误
        if (error.isAuthError) {
          this.showPermissionDialog('移动文件');
          return;
        }

        console.error('移动失败:', error);
        alert('移动失败,请检查目标路径是否正确');
      }
    },

    // 获取用户有权限访问的目录列表
    async getAccessibleFolders() {
      const accessibleFolders = [];

      // 如果是只读用户，直接返回空列表
      if (this.isReadOnlyUser) {
        return accessibleFolders;
      }

      // 检查目录是否有写入权限
      const checkWritePermission = async (path) => {
        try {
          // 准备请求头
          const headers = {};
          const savedCredentials = localStorage.getItem('authCredentials');
          if (savedCredentials) {
            headers['Authorization'] = `Basic ${savedCredentials}`;
          }

          // 尝试访问目录
          const response = await fetch(`/api/children/${path}`, { headers });
          const data = await response.json();

          // 如果需要登录或没有权限，返回false
          return !data.needLogin && response.status !== 403;
        } catch (error) {
          return false;
        }
      };

      // 收集所有可能的目录
      const allPossibleFolders = new Set();

      // 1. 添加根目录
      allPossibleFolders.add('');

      // 2. 添加当前目录（如果不是根目录）
      if (this.cwd !== '') {
        allPossibleFolders.add(this.cwd);
      }

      // 3. 添加上级目录
      if (this.cwd !== '') {
        const parentPath = this.cwd.replace(/[^\/]+\/$/, '');
        allPossibleFolders.add(parentPath);
      }

      // 4. 添加当前目录下的子目录
      if (this.folders && this.folders.length > 0) {
        for (const folder of this.folders) {
          allPossibleFolders.add(folder);
        }
      }

      // 5. 尝试发现根目录下的其他顶级目录
      try {
        const headers = {};
        const savedCredentials = localStorage.getItem('authCredentials');
        if (savedCredentials) {
          headers['Authorization'] = `Basic ${savedCredentials}`;
        }

        const response = await fetch(`/api/children/`, { headers });
        const data = await response.json();

        if (!data.needLogin && data.folders) {
          // 添加根目录下的所有目录
          for (const folder of data.folders) {
            allPossibleFolders.add(folder);
          }
        }
      } catch (error) {
        console.error('获取根目录失败:', error);
      }

      // 6. 检查每个目录的权限并构建结果
      for (const path of allPossibleFolders) {
        if (await checkWritePermission(path)) {
          let displayName;

          if (path === '') {
            displayName = '根目录';
          } else if (path === this.cwd) {
            displayName = '当前目录';
          } else if (this.cwd !== '' && path === this.cwd.replace(/[^\/]+\/$/, '')) {
            const parentDisplayName = path === '' ? '根目录' :
              path.replace(/.*\/(?!$)|\//g, '') + '/';
            displayName = `上级目录 (${parentDisplayName})`;
          } else {
            displayName = path.replace(/.*\/(?!$)|\//g, '') + '/';
          }

          accessibleFolders.push({
            path: path,
            displayName: displayName
          });
        }
      }

      // 去重
      const uniqueFolders = accessibleFolders.filter((folder, index, self) =>
        index === self.findIndex(f => f.path === folder.path)
      );

      // 排序：根目录 -> 当前目录 -> 上级目录 -> 其他目录
      uniqueFolders.sort((a, b) => {
        if (a.path === '') return -1;
        if (b.path === '') return 1;
        if (a.path === this.cwd) return -1;
        if (b.path === this.cwd) return 1;
        if (a.displayName.includes('上级目录')) return -1;
        if (b.displayName.includes('上级目录')) return 1;
        return a.displayName.localeCompare(b.displayName);
      });

      return uniqueFolders;
    },

    // 新增：递归获取目录下所有文件和子目录
    async getAllItems(prefix) {
      const items = [];
      let marker = null;

      do {
        const url = new URL(`/api/children/${prefix}`, window.location.origin);
        if (marker) {
          url.searchParams.set('marker', marker);
        }

        // 准备请求头
        const headers = {};
        const savedCredentials = localStorage.getItem('authCredentials');
        if (savedCredentials) {
          headers['Authorization'] = `Basic ${savedCredentials}`;
        }

        const response = await fetch(url, { headers });
        const data = await response.json();

        // 添加文件
        items.push(...data.value);

        // 处理子目录
        for (const folder of data.folders) {
          // 添加目录标记
          items.push({
            key: folder + '_$folder$',
            size: 0,
            uploaded: new Date().toISOString(),
          });

          // 递归获取子目录内容
          const subItems = await this.getAllItems(folder);
          items.push(...subItems);
        }

        marker = data.marker;
      } while (marker);

      return items;
    },

    uploadFiles(files) {
      if (this.cwd && !this.cwd.endsWith("/")) this.cwd += "/";

      const uploadTasks = Array.from(files).map((file) => ({
        basedir: this.cwd,
        file,
      }));
      this.uploadQueue.push(...uploadTasks);
      setTimeout(() => this.processUploadQueue());
    },

    // 全局搜索功能
    async performGlobalSearch(searchTerm) {
      if (!searchTerm || searchTerm.length < 2) {
        this.searchResults = [];
        return;
      }

      this.isSearching = true;
      this.searchResults = [];

      try {
        // 递归搜索所有目录
        const results = await this.searchInDirectory('', searchTerm);
        this.searchResults = results;
      } catch (error) {
        console.error('全局搜索失败:', error);
      } finally {
        this.isSearching = false;
      }
    },

    // 在指定目录中搜索
    async searchInDirectory(directory, searchTerm) {
      const results = [];

      try {
        // 准备请求头
        const headers = {};
        const savedCredentials = localStorage.getItem('authCredentials');
        if (savedCredentials) {
          headers['Authorization'] = `Basic ${savedCredentials}`;
        }

        const response = await fetch(`/api/children/${directory}`, { headers });
        const data = await response.json();

        if (data.needLogin) {
          return results;
        }

        // 搜索文件
        if (data.value) {
          for (const file of data.value) {
            const fileName = file.key.split('/').pop();
            if (fileName.toLowerCase().includes(searchTerm.toLowerCase())) {
              results.push({
                ...file,
                isFolder: false,
                displayPath: file.key
              });
            }
          }
        }

        // 搜索文件夹并递归
        if (data.folders) {
          for (const folder of data.folders) {
            const folderName = folder.split('/').filter(Boolean).pop();

            // 如果文件夹名匹配搜索词，添加到结果
            if (folderName && folderName.toLowerCase().includes(searchTerm.toLowerCase())) {
              results.push({
                key: folder,
                isFolder: true,
                displayPath: folder
              });
            }

            // 递归搜索子目录（限制深度避免无限递归）
            if (folder.split('/').length < 5) { // 最多搜索5层深度
              const subResults = await this.searchInDirectory(folder, searchTerm);
              results.push(...subResults);
            }
          }
        }
      } catch (error) {
        console.error(`搜索目录 ${directory} 失败:`, error);
      }

      return results;
    },
  },

  watch: {
    cwd: {
      handler() {
        // 切换目录时清除搜索结果
        this.searchResults = [];
        this.fetchFiles();
        const url = new URL(window.location);
        if ((url.searchParams.get("p") || "") !== this.cwd) {
          this.cwd
            ? url.searchParams.set("p", this.cwd)
            : url.searchParams.delete("p");
          window.history.pushState(null, "", url.toString());
        }
        document.title = this.cwd.replace(/.*\/(?!$)|\//g, "") === "/"
            ? "FlareDrive-R2 - 优雅的 Cloudflare R2 网盘文件库"
            :`${this.cwd.replace(/.*\/(?!$)|\//g, "") || "/" } - 优雅的 Cloudflare R2 网盘文件库`;
      },
      immediate: true,
    },

    search: {
      handler(newVal) {
        // 防抖搜索
        clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(() => {
          if (newVal && newVal.length >= 2) {
            this.performGlobalSearch(newVal);
          } else {
            this.searchResults = [];
          }
        }, 500); // 500ms 防抖
      }
    }
  },

  created() {
    window.addEventListener("popstate", (ev) => {
      const searchParams = new URL(window.location).searchParams;
      if (searchParams.get("p") !== this.cwd)
        this.cwd = searchParams.get("p") || "";
    });
  },

  components: {
    Dialog,
    Menu,
    MimeIcon,
    UploadPopup,
    Footer,
    MediaPreview,
  },
};
</script>

<style>
.main {
  display: flex;
  height: 100%;
  /* background-image: url(/assets/bg-light.webp); */
  background-size: cover;
  background-position: center;
  overflow-y: auto;
  flex-direction: column;
}

.app-bar {
  z-index: 2;
  position: sticky;
  top: 0;
  padding: 8px;
  background-color: white;
  display: flex;
}

@media (max-width: 400px) {
  .menu-button {
    margin: 0;
    padding: 0;
  }

  button.circle {
    padding: 0 8px;
  }
  .menu-button-text {
    display: none !important;
  }
}

@media (max-width: 340px) {
  .app-title-container {
    display: none !important;
  }
}

.menu-button {
  display: flex;
  position: relative;
  margin-left: 10px;
  padding: 0 10px;
}

.file-list-container {
  margin: 20px auto;
  padding: 10px;
  width: 60%;
  max-width: 95%;
  background: rgba(255, 255, 255, 0.5);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  transition: width 0.3s ease;
}

@media (max-width: 1280px) {
  .file-list-container {
    width: 768px;
    padding: 10px;
  }
}

.menu-button>button {
  transition: background-color 0.2s ease;
}

.menu-button>button:hover {
  background-color: rgb(212, 212, 212);
}

.menu {
  position: absolute;
  top: 100%;
  right: 0;
}

/* 浮动粘贴按钮样式 */
.floating-paste-button {
  position: fixed;
  z-index: 1000;
  background: #007bff;
  color: white;
  border-radius: 8px;
  padding: 8px 12px;
  cursor: move;
  box-shadow: 0 4px 12px rgba(0, 123, 255, 0.3);
  user-select: none;
  min-width: 100px;
  max-width: 200px;
  transition: all 0.2s ease;
  touch-action: none; /* 防止触摸时的默认行为 */
}

.floating-paste-button:hover {
  background: #0056b3;
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 123, 255, 0.4);
}

.floating-paste-button:active {
  transform: translateY(0);
}

/* 移动端样式 */
.floating-paste-button.mobile {
  min-width: 50px;
  max-width: 50px;
  padding: 12px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.floating-paste-button.mobile .paste-button-content {
  justify-content: center;
}

.paste-button-content {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 500;
}

.paste-file-info {
  font-size: 11px;
  opacity: 0.8;
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

/* 移动端优化 */
@media (max-width: 768px) {
  .floating-paste-button {
    min-width: 50px;
    max-width: 50px;
    padding: 12px;
    border-radius: 50%;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  }

  .floating-paste-button .paste-button-content {
    justify-content: center;
    font-size: 0; /* 隐藏文字 */
  }

  .floating-paste-button .paste-button-content span {
    display: none; /* 隐藏"粘贴"文字 */
  }

  .floating-paste-button .paste-file-info {
    display: none; /* 隐藏文件信息 */
  }
}
</style>
