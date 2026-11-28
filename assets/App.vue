<template>
  <div class="main" 
      @dragenter.prevent 
      @dragover.prevent 
      @drop.prevent="onDrop"
      :style="{ backgroundImage: `url('${backgroundImageUrl}')` }"
  >
    <!-- 底部进度条（含文件名/状态文字和百分比，原顶栏已移除） -->
    <div v-if="uploadProgress !== null" class="bottom-progress-wrap">
      <div class="bottom-progress-info">
        <span v-if="uploadFileName" v-text="uploadFileName" class="bottom-progress-name"></span>
        <span v-text="Math.round(uploadProgress) + '%'" class="bottom-progress-pct"></span>
      </div>
      <div class="bottom-progress-bar">
        <div class="bottom-progress-fill" :style="{ width: Math.min(100, Math.max(0, uploadProgress)) + '%' }"></div>
      </div>
    </div>
    <UploadPopup v-model="showUploadPopup" @upload="onUploadClicked" @createFolder="createFolder" @fetchUrl="fetchFromUrl"></UploadPopup>



    <!-- 登录/用户模态框 -->
    <div v-if="showModal" class="modal-overlay" @click="closeModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>{{ showChangePasswordForm ? '修改密码' : (isLoggedIn ? '用户管理' : '登录') }}</h3>
          <button class="close-button" @click="closeModal">&times;</button>
        </div>
        <div class="modal-body">
          <!-- 已登录状态 -->
          <div v-if="isLoggedIn && !showChangePasswordForm" class="user-info">
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
              <button @click="openChangePasswordForm" class="switch-user-button">修改密码</button>
              <button @click="switchUser" class="switch-user-button">切换用户</button>
              <button @click="logout" class="logout-button">退出登录</button>
            </div>
          </div>

          <!-- 修改密码表单 -->
          <form v-else-if="isLoggedIn && showChangePasswordForm" @submit.prevent="handleChangePassword">
            <div class="form-group">
              <label for="old-password">当前密码:</label>
              <input
                type="password"
                id="old-password"
                v-model="changePasswordForm.oldPassword"
                required
                autocomplete="current-password"
              >
            </div>
            <div class="form-group">
              <label for="new-password">新密码:</label>
              <input
                type="password"
                id="new-password"
                v-model="changePasswordForm.newPassword"
                required
                minlength="6"
                autocomplete="new-password"
              >
            </div>
            <div class="form-group">
              <label for="confirm-password">确认新密码:</label>
              <input
                type="password"
                id="confirm-password"
                v-model="changePasswordForm.confirmPassword"
                required
                minlength="6"
                autocomplete="new-password"
              >
            </div>
            <div class="form-actions">
              <button type="button" @click="closeChangePasswordForm" class="cancel-button">返回</button>
              <button type="submit" class="login-submit-button" :disabled="changePasswordLoading">
                {{ changePasswordLoading ? '提交中...' : '确认修改' }}
              </button>
            </div>
            <div v-if="changePasswordError" class="error-message">{{ changePasswordError }}</div>
            <div v-if="changePasswordSuccess" class="error-message" style="color:#4CAF50">{{ changePasswordSuccess }}</div>
          </form>

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
    <button v-if="canUpload" class="upload-button circle" @click="showUploadPopup = true" title="上传或新建">
      <svg viewBox="0 0 24 24" width="24" height="24" fill="#e6e6e6">
        <path d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z" />
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
          @keyup.enter="submitSearch"
          aria-label="Search"
          placeholder="🍿 搜索文件"
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
            { text: '粘贴文件到此目录', disabled: !clipboard || !canWrite || !canWriteHere || isPasting },
            { text: '管理分享链接', disabled: !isLoggedIn || isReadOnlyUser }
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

      <!-- 文件操作工具栏 -->
      <div v-if="!needLogin && !isMultiSelectMode && !isSearching && filteredFiles.length > 0" class="file-toolbar">
        <div class="toolbar-left">
          <button @click="toggleMultiSelectMode" class="toolbar-btn primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 12l2 2 4-4"/>
              <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9c1.09 0 2.13.2 3.1.56"/>
            </svg>
            多选模式
          </button>
        </div>
      </div>

      <!-- 多选工具栏 -->
      <div v-if="isMultiSelectMode" class="multi-select-toolbar">
        <div class="toolbar-left">
          <button @click="toggleMultiSelectMode" class="toolbar-btn">
            {{ isMultiSelectMode ? '退出多选' : '多选模式' }}
          </button>
          <span v-if="selectedFiles.length > 0" class="selected-count">
            已选择 {{ selectedFiles.length }} 个文件
          </span>
          <button v-if="selectedFiles.length > 0" @click="selectAllFiles" class="toolbar-btn">
            {{ selectedFiles.length === filteredFiles.length ? '取消全选' : '全选' }}
          </button>
        </div>
        <div v-if="selectedFiles.length > 0" class="toolbar-right">
          <button @click="batchDownload" class="toolbar-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7,10 12,15 17,10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            下载
          </button>
          <button @click="batchCopy" class="toolbar-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            复制
          </button>
          <button v-if="canWrite" @click="batchCut" class="toolbar-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14,2 14,8 20,8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <line x1="10" y1="9" x2="8" y2="9"/>
            </svg>
            剪切
          </button>
          <button v-if="canWrite" @click="batchDelete" class="toolbar-btn danger">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3,6 5,6 21,6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              <line x1="10" y1="11" x2="10" y2="17"/>
              <line x1="14" y1="11" x2="14" y2="17"/>
            </svg>
            删除
          </button>
        </div>
      </div>

      <!-- 文件列表 -->
      <ul v-if="!needLogin && !isSearching" class="file-list">
        <li v-if="cwd !== ''">
          <div tabindex="0" class="file-item" @click="cwd = cwd.replace(/[^\/]+\/$/, '')" @contextmenu.prevent>
            <div class="file-icon">
              <svg  viewBox="0 0 576 512"
                xmlns="http://www.w3.org/2000/svg" width="36" height="36">
                <defs>
                  <!-- Blue Gradient for the main body -->
                  <linearGradient id="mainGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="#4A90E2"/>>
                    <stop offset="100%" stop-color="#007AFF"/>>
                  </linearGradient>
                  <!-- Lighter Gradient for the folder flap/tab -->
                  <linearGradient id="flapGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="#74B9FF"/>>
                    <stop offset="100%" stop-color="#4A90E2"/>>
                  </linearGradient>
                  <!-- Filter for subtle outer glow/shadow -->
                  <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
                    <feGaussianBlur in="SourceAlpha" stdDeviation="4"/>>
                    <feOffset dx="0" dy="2"/>>
                    <feMerge>
                        <feMergeNode/>
                        <feMergeNode in="SourceGraphic"/>>
                    </feMerge>
                  </filter>
                </defs>
                <path fill="url(#flapGradient)" d="M384 480l48 0c11.4 0 21.9-6 27.6-15.9l112-192c5.8-9.9 5.8-22.1 .1-32.1S555.5 224 544 224l-400 0c-11.4 0-21.9 6-27.6 15.9L48 357.1 48 96c0-8.8 7.2-16 16-16l117.5 0c4.2 0 8.3 1.7 11.3 4.7l26.5 26.5c21 21 49.5 32.8 79.2 32.8L416 144c8.8 0 16 7.2 16 16l0 32 48 0 0-32c0-35.3-28.7-64-64-64L298.5 96c-17 0-33.3-6.7-45.3-18.7L226.7 50.7c-12-12-28.3-18.7-45.3-18.7L64 32C28.7 32 0 60.7 0 96L0 416c0 35.3 28.7 64 64 64l23.7 0L384 480z"/>
              </svg>
            </div>
            <div class="file-info-container"><span class="file-name">返回上级目录</span></div>

          </div>
        </li>
        <li v-for="folder in filteredFolders" :key="folder">
          <div tabindex="0" class="file-item" :class="{ 'cut-file': isCutFile(folder + '_$folder$') }" @click="cwd = folder" @contextmenu.prevent="
            showContextMenu = true;
          focusedItem = folder;
          ">
            <div class="file-icon">
              <svg xmlns="www.w3.org" viewBox="0 0 576 512">
                <defs v-if="cwd === ''">
                  <!-- Blue Gradient for the main body -->
                  <linearGradient id="mainGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="#4A90E2"/>>
                    <stop offset="100%" stop-color="#007AFF"/>>
                  </linearGradient>
                  <!-- Lighter Gradient for the folder flap/tab -->
                  <linearGradient id="flapGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="#74B9FF"/>>
                    <stop offset="100%" stop-color="#4A90E2"/>>
                  </linearGradient>
                  <!-- Filter for subtle outer glow/shadow -->
                  <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
                    <feGaussianBlur in="SourceAlpha" stdDeviation="4"/>>
                    <feOffset dx="0" dy="2"/>>
                    <feMerge>
                        <feMergeNode/>
                        <feMergeNode in="SourceGraphic"/>>
                    </feMerge>
                  </filter>
                </defs>
                <!-- The main back part of the folder (has the glow filter) -->
                <rect x="16" y="160" width="512" height="320" rx="32" fill="url(#mainGradient)" filter="url(#shadow)"/>>

                <!-- The folder flap/tab - Adjusted path to start at a rounded corner on the left -->
                <path fill="url(#flapGradient)" d="M16 192V128c0-35.3 28.7-64 64-64H176c17 0 33.3 6.7 45.3 18.7L253.3 112c12 12 28.3 18.7 45.3 18.7H496c35.3 0 64 28.7 64 64V448c0 35.3-28.7 64-64 64H48c-17.6 0-32-14.4-32-32V192z"/>>

                <!-- A subtle highlight for the flap -->
                <path fill="#ffffff" opacity="0.2" d="M80 64H176c17 0 33.3 6.7 45.3 18.7L253.3 112c12 12 28.3 18.7 45.3 18.7H496c35.3 0 64 28.7 64 64v16H16V128c0-35.3 28.7-64 64-64z"/>>
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
          <div
            @click="handleFileClick(file)"
            @contextmenu.prevent="showContextMenu = true; focusedItem = file;"
            class="file-item"
            style="position: relative;"
            :class="{ 'selected': isFileSelected(file.key), 'cut-file': isCutFile(file.key) }"
          >
            <!-- 多选复选框 -->
            <div v-if="isMultiSelectMode" class="file-checkbox" @click.stop="toggleFileSelection(file.key)">
              <input type="checkbox" :checked="isFileSelected(file.key)" @click.stop @change.stop="toggleFileSelection(file.key)">
            </div>
            <MimeIcon :content-type="file.httpMetadata?.contentType || 'application/octet-stream'" :thumbnail="file.customMetadata?.thumbnail
              ? thumbnailUrl(file)
              : null
              " />
            <div class="file-info-container">
              <div class="file-name" v-text="file.key.split('/').pop()"></div>
              <div class="file-attr">
                <!-- 搜索结果显示完整路径 -->
                <span v-if="search && searchResults.length > 0" class="file-path" v-text="file.displayPath || file.key"></span>
                <span v-if="file.uploaded" v-text="new Date(file.uploaded).toLocaleString('zh-CN')"></span>
                <span v-if="file.size" v-text="formatSize(file.size)"></span>
              </div>
            </div>
            <div style="margin-right: 10px;margin-left: auto;"
                 @click.stop="showContextMenu = true; focusedItem = file;"
                 @touchstart.stop
                 @touchend.stop>
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
      <div v-if="isSearching" style="margin: 20px 0; text-align: center">
        <span style="font-size: 20px;">搜索中...</span>
      </div>
      <div v-else-if="!loading && !needLogin && !filteredFiles.length && !filteredFolders.length" style="margin: 20px 0; text-align: center">
        <span style="font-size: 20px;">没有文件</span>
      </div>
      <div v-if="listTruncated && !search" style="margin: 10px 0; text-align: center; color: #b26a00;">
        <span>本目录文件过多，仅显示前 20 万个，请分目录查看。</span>
      </div>
      <div v-if="search && (searchDepthLimited || searchTruncated)" style="margin: 10px 0; text-align: center; color: #b26a00;">
        <span v-if="searchDepthLimited">搜索只覆盖 5 层以内的目录，更深的文件未包含。</span>
        <span v-if="searchTruncated">部分目录文件过多，搜索结果不完整。</span>
      </div>
    </div>
    <Dialog v-model="showContextMenu">
      <div
        style="height: 50px;display: flex; justify-content: center; align-items: center; padding:10px; background: #ddd; margin: 0 0 10px 0; border-radius: 8px;">
        <div v-text="focusedItem.key || focusedItem" class="contextmenu-filename" @click.stop.prevent
          style="width: 100%; max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"></div>
      </div>
      <ul v-if="typeof focusedItem === 'string'" class="contextmenu-list">
        <li>
          <button @click="copyDirectoryLink(focusedItem)">
            <span>复制目录链接</span>
          </button>
        </li>
        <li>
          <button @click="copyFile(focusedItem + '_$folder$')" :disabled="isGuest || isReadOnlyUser">
            <span>复制</span>
          </button>
        </li>
        <li v-if="canWrite">
          <button @click="cutFile(focusedItem + '_$folder$')">
            <span>剪切</span>
          </button>
        </li>
        <li v-if="clipboard && canWrite">
          <button @click="pasteFile()" :disabled="isPasting">
            <span>粘贴</span>
          </button>
        </li>
        <li v-if="canWrite">
          <button style="color: red" @click="removeFolder(focusedItem)">
            <span>删除</span>
          </button>
        </li>
      </ul>
      <ul v-else class="contextmenu-list">
        <li v-if="canWrite">
          <button @click="renameFile(focusedItem.key)">
            <span>重命名</span>
          </button>
        </li>
        <li>
          <button @click="singleDownload(focusedItem.key)">
            <span>下载</span>
          </button>
        </li>
        <li>
          <button @click="copyFile(focusedItem.key)" :disabled="isGuest || isReadOnlyUser">
            <span>复制</span>
          </button>
        </li>
        <li v-if="canWrite">
          <button @click="cutFile(focusedItem.key)">
            <span>剪切</span>
          </button>
        </li>
        <li>
          <button @click="openShareDialog(focusedItem.key)" :disabled="isGuest || isReadOnlyUser">
            <span>分享</span>
          </button>
        </li>
        <li v-if="canWrite && canRegenerateThumbnail(focusedItem.key)">
          <button @click="regenerateThumbnail(focusedItem)">
            <span>重新生成缩略图</span>
          </button>
        </li>
        <li v-if="clipboard && canWrite">
          <button @click="pasteFile()" :disabled="isPasting">
            <span>粘贴</span>
          </button>
        </li>
        <li v-if="canWrite">
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
      :is-guest="isGuest"
      :is-read-only="isReadOnlyUser"
      @close="closeMediaPreview"
      @show-toast="showCustomToast"
      @request-share="openShareDialog"
      @request-download="({ key, name }) => downloadWithPerFileToken(key, name)"
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

    <!-- 自定义确认对话框 -->
    <Dialog v-model="showConfirmDialog">
      <div style="padding: 20px;">
        <h3 v-text="confirmDialog.title" style="margin: 0 0 15px 0;"></h3>
        <p v-text="confirmDialog.message" style="margin: 0 0 20px 0; line-height: 1.5;"></p>
        <div style="display: flex; gap: 10px; justify-content: flex-end;">
          <button @click="cancelConfirm" style="padding: 8px 16px; border: 1px solid #ddd; background: white; border-radius: 4px;">{{ confirmDialog.cancelText || '取消' }}</button>
          <button @click="confirmAction" :style="`padding: 8px 16px; background: ${confirmDialog.type === 'danger' ? '#dc3545' : '#007bff'}; color: white; border: none; border-radius: 4px;`">{{ confirmDialog.confirmText || '确定' }}</button>
        </div>
      </div>
    </Dialog>

    <!-- 分享对话框（H1/H2/D1）：生成只对单个文件有效的签名链接，显示在文本框里 -->
    <Dialog v-model="showShareDialog">
      <div style="padding: 20px; width: 360px; max-width: 90vw;">
        <h3 style="margin: 0 0 8px 0;">分享文件</h3>
        <p v-text="shareDialog.name" style="margin: 0 0 15px 0; color: #666; word-break: break-all;"></p>
        <div style="margin-bottom: 15px;">
          <div style="margin-bottom: 8px; color: #333;">有效期：</div>
          <div style="display: flex; gap: 8px;">
            <button
              v-for="d in [1, 7, 30]"
              :key="d"
              @click="setShareDays(d)"
              :style="`flex: 1; padding: 8px; border: 1px solid ${shareDialog.days === d ? '#007bff' : '#ddd'}; background: ${shareDialog.days === d ? '#e3f2fd' : 'white'}; color: ${shareDialog.days === d ? '#007bff' : '#333'}; border-radius: 4px; cursor: pointer;`"
            >{{ d }} 天</button>
            <button
              @click="setShareDays(0)"
              :style="`flex: 1; padding: 8px; border: 1px solid ${shareDialog.days === 0 ? '#007bff' : '#ddd'}; background: ${shareDialog.days === 0 ? '#e3f2fd' : 'white'}; color: ${shareDialog.days === 0 ? '#007bff' : '#333'}; border-radius: 4px; cursor: pointer;`"
            >长期有效</button>
          </div>
          <p v-if="shareDialog.isPublic" style="margin: 8px 0 0 0; color: #666; font-size: 13px;">这是公开文件，即使不分享也可直接访问。</p>
        </div>
        <div style="margin-bottom: 15px;">
          <div style="margin-bottom: 8px; color: #333;">访问密码（可选）：</div>
          <input
            type="password"
            v-model="shareDialog.password"
            @change="onShareOptionsChanged"
            placeholder="留空表示无需密码"
            autocomplete="new-password"
            style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;"
          />
        </div>
        <div style="margin-bottom: 15px;">
          <div style="margin-bottom: 8px; color: #333;">下载次数上限（可选）：</div>
          <input
            type="number"
            min="1"
            v-model="shareDialog.maxDownloads"
            @change="onShareOptionsChanged"
            placeholder="留空表示不限次数"
            style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;"
          />
        </div>
        <div v-if="shareDialog.url" style="margin-bottom: 12px;">
          <input
            readonly
            :value="shareDialog.url"
            @click="$event.target.select()"
            style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; margin-bottom: 8px; font-size: 13px;"
          />
          <p style="margin: 0; color: #666; font-size: 13px;">有效期至 {{ shareDialog.expiresText }}</p>
        </div>
        <div v-if="shareDialog.loading" style="text-align: center; color: #666; padding: 10px 0;">正在生成链接…</div>
        <div style="display: flex; gap: 10px; margin-bottom: 12px;">
          <button @click="copyShareUrl" :disabled="shareDialog.loading" style="flex: 1; padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">复制链接</button>
          <button @click="showShareDialog = false" style="padding: 8px 16px; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer;">关闭</button>
        </div>
        <p v-if="shareDialog.error" style="color: #dc3545; margin: 10px 0 0 0;" v-text="shareDialog.error"></p>
      </div>
    </Dialog>

    <!-- 分享管理对话框（D1）：列出自己创建的分享，支持复制与撤销 -->
    <Dialog v-model="showSharesDialog">
      <div style="padding: 20px; width: 480px; max-width: 90vw;">
        <h3 style="margin: 0 0 8px 0;">管理分享链接</h3>
        <p style="margin: 0 0 15px 0; color: #666; font-size: 13px;">下载次数按下载请求计数。撤销后链接立即失效。</p>
        <div v-if="sharesLoading" style="text-align: center; color: #666; padding: 10px 0;">加载中…</div>
        <div v-else-if="sharesError" style="color: #dc3545;" v-text="sharesError"></div>
        <div v-else-if="!sharesList.length" style="text-align: center; color: #666; padding: 10px 0;">暂无分享链接</div>
        <ul v-else style="list-style: none; margin: 0; padding: 0; max-height: 50vh; overflow-y: auto;">
          <li v-for="s in sharesList" :key="s.id" style="border: 1px solid #eee; border-radius: 8px; padding: 10px; margin-bottom: 8px;">
            <div style="font-weight: bold; word-break: break-all;" v-text="s.name"></div>
            <div style="color: #666; font-size: 13px; word-break: break-all;" v-text="s.key"></div>
            <div style="color: #666; font-size: 13px;">
              {{ s.expiresAt ? '有效期至 ' + new Date(s.expiresAt * 1000).toLocaleString('zh-CN') : '长期有效' }}
              · 已下载 {{ s.downloads }} 次{{ s.maxDownloads ? ' / 上限 ' + s.maxDownloads + ' 次' : '' }}
              <span v-if="s.hasPassword">· 有密码</span>
            </div>
            <div style="display: flex; gap: 8px; margin-top: 8px;">
              <button @click="copyShareManageUrl(s)" style="padding: 6px 12px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">复制链接</button>
              <button @click="revokeShare(s)" style="padding: 6px 12px; border: 1px solid #dc3545; color: #dc3545; background: white; border-radius: 4px; cursor: pointer;">撤销</button>
            </div>
          </li>
        </ul>
        <div style="text-align: right; margin-top: 12px;">
          <button @click="showSharesDialog = false" style="padding: 8px 16px; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer;">关闭</button>
        </div>
      </div>
    </Dialog>

    <!-- 离线下载对话框（D3）：URL 表单 + 目标目录 + 大小上限，下载中显示已用时 -->
    <Dialog v-model="showFetchDialog">
      <div style="padding: 20px; width: 420px; max-width: 90vw;">
        <h3 style="margin: 0 0 15px 0;">离线下载</h3>
        <div style="margin-bottom: 15px;">
          <div style="margin-bottom: 8px; color: #333;">下载链接：</div>
          <input
            type="url"
            v-model="fetchDialog.url"
            :disabled="fetchDialog.loading"
            @keyup.enter="submitFetchDialog"
            placeholder="https://example.com/file.zip"
            style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;"
          />
        </div>
        <p style="margin: 0 0 8px 0; color: #666; font-size: 13px;">保存到：<span v-text="fetchDialog.target" style="word-break: break-all;"></span></p>
        <p style="margin: 0 0 15px 0; color: #666; font-size: 13px;">单个文件上限 256 MiB；目标服务器不返回文件大小时上限 64 MB。同名文件不会被覆盖，会保存为「名称 (1).扩展名」。</p>
        <div v-if="fetchDialog.loading" style="text-align: center; color: #666; padding: 10px 0;">服务器正在下载…已用时 {{ fetchDialog.elapsed }} 秒，请稍候</div>
        <p v-if="fetchDialog.error" style="color: #dc3545; margin: 10px 0 0 0;" v-text="fetchDialog.error"></p>
        <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 15px;">
          <button @click="showFetchDialog = false" :disabled="fetchDialog.loading" style="padding: 8px 16px; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer;">取消</button>
          <button @click="submitFetchDialog" :disabled="fetchDialog.loading || !fetchDialog.url.trim()" style="padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">开始下载</button>
        </div>
      </div>
    </Dialog>

    <!-- 浮动粘贴按钮（桌面：宽版右上角；移动：右侧 56px 小方块，可触摸拖动） -->
    <div
      v-if="clipboard && canWrite && canWriteHere"
      class="floating-paste-button"
      :class="{ 'desktop': !isMobile, 'mobile': isMobile, 'auto-hide': !isMobile && !isNearPasteButton, 'is-pasting': isPasting }"
      :style="{ left: pasteButtonPosition.x + 'px', top: pasteButtonPosition.y + 'px' }"
      @mousedown="startDragPasteButton"
      @touchstart="startDragPasteButton"
      @touchend="handleTouchEnd"
      @click="handlePasteButtonClick"
      @mouseenter="isNearPasteButton = true"
      @mouseleave="isNearPasteButton = false"
    >
      <div class="paste-button-content">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
        </svg>
        <span v-if="!isMobile">{{ clipboardIsCut ? '粘贴（移动）' : '粘贴' }}</span>
        <kbd v-if="!isMobile" class="shortcut-hint">Ctrl+V</kbd>
      </div>
      <div v-if="!isMobile" class="paste-file-info">
        {{ clipboardLabel() }}
      </div>
      <!-- 移动端：角上的 ×，点一下取消剪贴板（桌面用 Esc 取消） -->
      <button v-if="isMobile" class="paste-dismiss-btn" @touchstart.stop @touchend.stop.prevent="clearClipboard" @click.stop="clearClipboard" aria-label="取消">×</button>
    </div>

    <!-- 自定义提示组件 -->
    <div v-if="showToast" class="custom-toast" :class="toastType">
      <div class="toast-content">
        <svg v-if="toastType === 'success'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 12l2 2 4-4"/>
          <circle cx="12" cy="12" r="10"/>
        </svg>
        <svg v-else-if="toastType === 'error'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="15" y1="9" x2="9" y2="15"/>
          <line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
        <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <span>{{ toastMessage }}</span>
      </div>
    </div>

    <!-- 屏幕中央的阻断式进度提示（比如重新生成缩略图这种耗时较长的操作） -->
    <div v-if="centerProgress.visible" class="center-progress-overlay">
      <div class="center-progress-box">
        <div class="center-progress-spinner"></div>
        <div class="center-progress-text">{{ centerProgress.text }}</div>
        <div v-if="centerProgress.fileName" class="center-progress-filename">{{ centerProgress.fileName }}</div>
      </div>
    </div>

    <div style="flex:1"></div>

    <!-- 快捷键说明 -->
    <div v-if="!needLogin" class="keyboard-shortcuts">
      <div class="shortcuts-container">
        <h4 class="shortcuts-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
            <line x1="8" y1="21" x2="16" y2="21"/>
            <line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
          快捷键
        </h4>
        <div class="shortcuts-grid">
          <div class="shortcut-item">
            <kbd>Ctrl</kbd> + <kbd>A</kbd>
            <span>切换多选模式</span>
          </div>
          <div class="shortcut-item">
            <kbd>Ctrl</kbd> + <kbd>V</kbd>
            <span>粘贴文件</span>
          </div>
          <div class="shortcut-item">
            <kbd>ESC</kbd>
            <span>退出多选模式</span>
          </div>
          <div class="shortcut-item">
            <kbd>Delete</kbd>
            <span>删除选中文件</span>
          </div>
          <div class="shortcut-item mobile-only">
            <span class="touch-icon">📱</span>
            <span>点击"多选模式"按钮进入多选</span>
          </div>
        </div>
      </div>
    </div>

    <Footer />
  </div>
</template>

<script>
import {
  generateThumbnail,
  generateThumbnailFromUrl,
  blobDigest,
  multipartUpload,
  apiPath,
  SIZE_LIMIT,
} from "/assets/main.mjs";
import Dialog from "./Dialog.vue";
import Menu from "./Menu.vue";
import MimeIcon from "./MimeIcon.vue";
import UploadPopup from "./UploadPopup.vue";
import Footer from "./Footer.vue";
import MediaPreview from "./MediaPreview.vue";

// 根据扩展名推断真实 MIME 类型，专供"重新生成缩略图"功能使用。
// 之所以不能直接信任 /raw/ 返回的 Content-Type：很多旧文件是通过普通 PUT
// 上传的，服务端此前从未存储 content-type（另一个已修复的 bug），
// /raw/ 对这些文件返回的 Content-Type 本身就是缺失或者是错误的通用值，
// 用它来判断"这是不是视频/图片"是不可靠的，只能从文件名后缀反推。
const EXT_MIME_MAP = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  ico: "image/x-icon",
  svg: "image/svg+xml",
  mp4: "video/mp4",
  webm: "video/webm",
  ogv: "video/ogg",
  mov: "video/quicktime",
  avi: "video/x-msvideo",
  wmv: "video/x-ms-wmv",
  mkv: "video/x-matroska",
};

export default {
  data: () => ({
    cwd: new URL(window.location).searchParams.get("p") || "",
    files: [],
    folders: [],
    clipboard: null,
    clipboardIsCut: false, // 剪贴板内容是否为剪切（粘贴后移动源文件）；复制时为 false
    canWriteHere: true, // 当前目录是否有写权限（导航时调接口查；默认 true，查完再纠正）
    focusedItem: null,
    loading: false,
    order: null,
    search: "",
    searchResults: [], // 全局搜索结果
    isSearching: false, // 搜索状态
    searchDepthLimited: false, // 搜索触及 5 层深度上限，更深的文件未包含
    searchTruncated: false, // 搜索时某个目录文件过多，未搜完
    searchTimeout: null, // 搜索防抖定时器
    listTruncated: false, // 当前目录文件过多，列表未显示完（M6）
    isSearchExpanded: false, // 搜索框是否展开
    showContextMenu: false,
    showMenu: false,
    showUploadPopup: false,
    uploadProgress: null,
    uploadFileName: '', // 进度条当前对应的文件名（上传队列按文件显示，避免百分比乱跳）
    uploadQueue: [],
    currentUpload: null, // F3：正在传的文件 { basedir, name }，已不在队列里；uploadFiles 算撞名时把它也算进去
    isPasting: false, // v20：粘贴进行中（移动/复制/文件夹传输）；为 true 时所有粘贴入口都置灰/忽略
    backgroundImageUrl: "/assets/bg-cat.webp",
    needLogin: false,
    isGuest: true, // 默认为游客状态
    guestDirs: [], // 访客目录（GUEST 环境变量），该目录下的文件不建分享、直接给公开直链
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
    // 修改密码相关
    showChangePasswordForm: false,
    changePasswordForm: {
      oldPassword: '',
      newPassword: '',
      confirmPassword: ''
    },
    changePasswordLoading: false,
    changePasswordError: '',
    changePasswordSuccess: '',
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
    showConfirmDialog: false,
    confirmDialog: {
      title: '',
      message: '',
      type: 'default', // 'default', 'danger'
      confirmText: '',
      cancelText: '',
      resolve: null,
      reject: null
    },
    // 分享对话框相关（D1：有状态短分享链接，POST /api/shares 创建）
    showShareDialog: false,
    shareDialog: {
      key: '',
      name: '',
      days: 7,
      password: '',
      maxDownloads: '',
      shareId: '',
      url: '',
      expiresText: '',
      isPublic: false,
      loading: false,
      error: ''
    },
    // 分享管理对话框相关（D1）
    showSharesDialog: false,
    sharesList: [],
    sharesLoading: false,
    sharesError: '',
    // 离线下载对话框相关（D3）
    showFetchDialog: false,
    fetchDialog: { url: '', target: '/', loading: false, error: '', elapsed: 0 },
    fetchTimer: null,
    // 浮动粘贴按钮相关
    pasteButtonPosition: { x: 0, y: 0 },
    isDraggingPasteButton: false,
    dragOffset: { x: 0, y: 0 },
    dragStartTime: 0,
    hasMoved: false,
    // 自定义提示相关
    showToast: false,
    toastMessage: '',
    toastType: 'success', // 'success', 'error', 'warning'
    // 屏幕中央的阻断式进度提示，用于耗时较长的操作（比如重新生成大视频的缩略图），
    // 和右上角一闪而过的 toast 不一样，这个会一直显示直到操作结束
    centerProgress: { visible: false, text: '', fileName: '' },
    // /raw/ 读取用的签名令牌：由文件列表接口随目录内容一起下发
    rawTokens: [],
    // 多选功能相关
    selectedFiles: [], // 选中的文件列表
    isMultiSelectMode: false, // 是否处于多选模式
    showBatchActions: false, // 是否显示批量操作栏
    // 粘贴按钮相关
    isNearPasteButton: false
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

    // 检查是否可以进行写操作（移动、复制、粘贴、删除）
    canWrite() {
      // 游客不允许写操作
      if (this.isGuest) {
        return false;
      }
      // 只读用户不允许写操作
      if (this.isReadOnlyUser) {
        return false;
      }
      // 已登录用户可以写操作
      return this.isLoggedIn;
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

    // 添加键盘快捷键监听
    document.addEventListener('keydown', this.handleKeyDown);
  },

  beforeUnmount() {
    // 清理事件监听器
    document.removeEventListener('mousemove', this.dragPasteButton);
    document.removeEventListener('mouseup', this.stopDragPasteButton);
    document.removeEventListener('touchmove', this.dragPasteButton);
    document.removeEventListener('touchend', this.stopDragPasteButton);
    document.removeEventListener('keydown', this.handleKeyDown);
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
        this.performGlobalSearch(this.search.trim());
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

    // 点击搜索按钮或按回车时触发搜索（输入时不再自动搜索）
    submitSearch() {
      const term = this.search.trim();
      if (!term) {
        this.searchResults = [];
        return;
      }
      if (term.length < 2) return;
      this.performGlobalSearch(term);
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

    // 记录文件列表接口下发的签名令牌
    registerRawToken(data) {
      if (!data || !data.rawToken) return;
      if (typeof data.rawTokenPrefix === 'string') {
        const rest = this.rawTokens.filter(t => t.prefix !== data.rawTokenPrefix).slice(-500);
        rest.push({ prefix: data.rawTokenPrefix, token: data.rawToken });
        this.rawTokens = rest;
      }
    },

    // 生成应用内使用的 /raw/ 地址（缩略图、预览、全景图、下载）。
    // GUEST 目录下的文件不需要令牌；其他文件带上所在目录的签名令牌。
    rawUrl(key) {
      const base = '/raw/' + key.split('/').map(encodeURIComponent).join('/');
      let best = null;
      for (const t of this.rawTokens) {
        if (key.startsWith(t.prefix) && (!best || t.prefix.length > best.prefix.length)) best = t;
      }
      return best ? `${base}?token=${best.token}` : base;
    },

    // #13：缩略图用文件自带的逐文件令牌（children 下发），不再共用覆盖
    // 整个缩略图目录的 rawToken。
    thumbnailUrl(file) {
      const digest = file.customMetadata?.thumbnail;
      if (!digest) return '';
      const base = `/raw/_$flaredrive$/thumbnails/${digest}.png`;
      return file.thumbToken ? `${base}?token=${file.thumbToken}` : base;
    },

    // 该文件是否在访客目录（GUEST）下：访客目录本来就是公开可读的，
    // 不建分享记录，点分享直接复制公开直链（与 /api/sign 的处理一致）。
    isGuestDir(key) {
      return (this.guestDirs || []).some((d) => {
        const p = d.endsWith('/') ? d : d + '/';
        return key.startsWith(p);
      });
    },

    // 打开统一的分享对话框（H1/H2）：生成只对该文件有效、带过期时间的
    // 签名链接并显示在文本框里。访客目录下的文件不打开对话框，
    // 直接复制公开直链（不建分享记录，有效期/密码对公开文件没有意义）。
    async openShareDialog(key) {
      if (this.isGuest || this.isReadOnlyUser) {
        this.showCustomToast(this.isReadOnlyUser ? '只读用户无法分享文件' : '请先登录', 'error');
        this.showContextMenu = false;
        return;
      }
      // 预览打开时先关掉预览：分享框的层级（9998）低于预览浮层（10001），
      // 不关预览，分享框会被盖在后面点不到。
      this.closeMediaPreview();
      this.showContextMenu = false;
      // 访客目录：不建分享，直接复制公开直链（无令牌，永久有效）。
      if (this.isGuestDir(key)) {
        const url = window.location.origin + '/raw/' + key.split('/').map(encodeURIComponent).join('/');
        try {
          await this.writeClipboard(url);
          this.showCustomToast('该文件已公开，已复制公开直链', 'success');
        } catch (error) {
          this.showCustomToast('复制失败：浏览器拒绝写入剪贴板', 'error');
        }
        return;
      }
      const file = this.files.find((f) => f.key === key);
      this.shareDialog = {
        key,
        name: file ? file.name : key.split('/').pop(),
        days: 7,
        password: '',
        maxDownloads: '',
        shareId: '',
        url: '',
        expiresText: '',
        isPublic: false,
        loading: false,
        error: ''
      };
      this.showShareDialog = true;
    },

    setShareDays(days) {
      if (this.shareDialog.days === days || this.shareDialog.loading) return;
      this.shareDialog.days = days;
      this.onShareOptionsChanged();
    },

    // 选项变化时：如果本轮已生成过链接，重新生成（带 replaceId，旧链接作废）；
    // 还没生成过时只改本地选项，不发请求——分享只在点“复制链接”时才创建。
    onShareOptionsChanged() {
      if (this.shareDialog.url) this.generateShareLink();
    },

    // D1：向服务端申请一个有状态的短分享链接（POST /api/shares），返回
    // /share/{id}。改选项重新生成时带上 replaceId，服务端会删掉上一条
    // 同文件分享，避免管理页堆积孤儿记录。
    async generateShareLink() {
      const dialog = this.shareDialog;
      dialog.loading = true;
      dialog.error = '';
      dialog.url = '';
      try {
        const headers = { 'Content-Type': 'application/json' };
        const savedCredentials = localStorage.getItem('authCredentials');
        if (savedCredentials) headers['Authorization'] = `Basic ${savedCredentials}`;

        const body = {
          key: dialog.key,
          days: dialog.days,
          password: dialog.password || undefined,
          maxDownloads: dialog.maxDownloads === '' || dialog.maxDownloads === null ? undefined : Number(dialog.maxDownloads),
          replaceId: dialog.shareId || undefined
        };
        const response = await fetch('/api/shares', {
          method: 'POST',
          headers,
          body: JSON.stringify(body)
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.url) throw new Error(data.error || `生成链接失败（HTTP ${response.status}）`);

        dialog.shareId = data.id;
        dialog.url = data.url;
        dialog.isPublic = !!data.public;
        dialog.expiresText = data.expiresAt
          ? new Date(data.expiresAt * 1000).toLocaleString('zh-CN')
          : '长期有效';
      } catch (error) {
        dialog.error = error.message || '生成链接失败';
        this.showCustomToast('生成分享链接失败: ' + dialog.error, 'error');
      } finally {
        dialog.loading = false;
      }
    },

    // 点“复制链接”时才真正创建分享：先 POST 生成链接，再复制到剪贴板，
    // 成功后关闭对话框。创建失败时报错并不关闭；复制失败时也不关闭，
    // 链接已生成，用户可以重试。创建进行中禁止重复提交。
    async copyShareUrl() {
      const dialog = this.shareDialog;
      if (dialog.loading) return;
      if (!dialog.url) {
        await this.generateShareLink();
        // 生成失败：generateShareLink 已设置 dialog.error 并提示过
        if (!dialog.url) return;
      }
      try {
        await this.writeClipboard(dialog.url);
        this.showCustomToast('分享链接已复制到剪贴板', 'success');
        this.showShareDialog = false;
      } catch (error) {
        this.showCustomToast('复制失败：浏览器拒绝写入剪贴板', 'error');
      }
    },

    // D1：打开分享管理，列出自己创建的分享（管理员看全部）
    async openSharesDialog() {
      if (!this.isLoggedIn) {
        this.showLoginModal();
        return;
      }
      if (this.isReadOnlyUser) {
        this.showCustomToast('只读用户无法管理分享链接', 'error');
        return;
      }
      this.showSharesDialog = true;
      this.sharesLoading = true;
      this.sharesError = '';
      try {
        const headers = {};
        const savedCredentials = localStorage.getItem('authCredentials');
        if (savedCredentials) headers['Authorization'] = `Basic ${savedCredentials}`;
        const response = await fetch('/api/shares', { headers });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || `加载失败（HTTP ${response.status}）`);
        this.sharesList = data.shares || [];
      } catch (error) {
        this.sharesError = error.message || '加载失败';
      } finally {
        this.sharesLoading = false;
      }
    },

    async copyShareManageUrl(share) {
      try {
        await this.writeClipboard(share.url);
        this.showCustomToast('分享链接已复制到剪贴板', 'success');
      } catch (error) {
        this.showCustomToast('复制失败：浏览器拒绝写入剪贴板', 'error');
      }
    },

    // D1：撤销分享（删记录，链接立即失效）
    async revokeShare(share) {
      try {
        const headers = {};
        const savedCredentials = localStorage.getItem('authCredentials');
        if (savedCredentials) headers['Authorization'] = `Basic ${savedCredentials}`;
        const response = await fetch(`/api/shares/${share.id}`, { method: 'DELETE', headers });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || `撤销失败（HTTP ${response.status}）`);
        this.sharesList = this.sharesList.filter((s) => s.id !== share.id);
        this.showCustomToast('分享链接已撤销', 'success');
      } catch (error) {
        this.showCustomToast('撤销失败: ' + (error.message || '未知错误'), 'error');
      }
    },

    async writeClipboard(text) {
      try {
        await navigator.clipboard.writeText(text);
      } catch (e) {
        // 部分浏览器在异步请求之后不再允许直接写剪贴板，退回到 execCommand
        const area = document.createElement('textarea');
        area.value = text;
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(area);
        if (!ok) throw new Error('浏览器拒绝写入剪贴板');
      }
    },

    // 离线下载：打开表单对话框（D3），真正下载在 submitFetchDialog 里
    fetchFromUrl() {
      this.showUploadPopup = false;
      if (!this.canWrite) {
        this.showPermissionDialog('离线下载');
        return;
      }
      this.fetchDialog = { url: '', target: this.cwd || '/', loading: false, error: '', elapsed: 0 };
      this.showFetchDialog = true;
    },

    async submitFetchDialog() {
      const url = (this.fetchDialog.url || '').trim();
      if (!url) return;
      if (!/^https?:\/\//i.test(url)) {
        this.fetchDialog.error = '只支持 http/https 链接';
        return;
      }
      this.fetchDialog.error = '';
      this.fetchDialog.loading = true;
      this.fetchDialog.elapsed = 0;
      this.fetchTimer = setInterval(() => { this.fetchDialog.elapsed += 1; }, 1000);
      let saved = null;
      try {
        const headers = { 'Content-Type': 'application/json' };
        const savedCredentials = localStorage.getItem('authCredentials');
        if (savedCredentials) headers['Authorization'] = `Basic ${savedCredentials}`;

        const response = await fetch('/api/write/fetch', {
          method: 'POST',
          headers,
          body: JSON.stringify({ url, dir: this.cwd })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.key) {
          if (response.status === 401 || response.status === 403) {
            this.showFetchDialog = false;
            this.showPermissionDialog('离线下载');
            return;
          }
          throw new Error(data.error || `服务器返回 ${response.status}`);
        }
        saved = data;
      } catch (error) {
        this.fetchDialog.error = '离线下载失败: ' + (error.message || '未知错误');
        return;
      } finally {
        clearInterval(this.fetchTimer);
        this.fetchTimer = null;
        this.fetchDialog.loading = false;
      }

      this.showFetchDialog = false;
      const name = saved.key.split('/').pop();
      this.showCustomToast(`已保存 "${name}"（${this.formatSize(saved.size)}）`, 'success');
      await this.fetchFiles();
      // 图片/视频顺手生成缩略图
      if (this.canRegenerateThumbnail(saved.key)) {
        await this.regenerateThumbnail({ key: saved.key });
      }
    },

    // 复制目录链接（文件夹右键菜单）：应用内地址，接收方需要登录后才能打开。
    // 和文件分享链接是两回事，标签上要区分开（H2）。
    async copyDirectoryLink(path) {
      const url = new URL(`/?p=${encodeURIComponent(path)}`, window.location.origin).toString();
      try {
        await this.writeClipboard(url);
        this.showCustomToast('目录链接已复制到剪贴板', 'success');
      } catch (error) {
        this.showCustomToast('复制失败：浏览器拒绝写入剪贴板', 'error');
      }
      // 关闭右键菜单
      this.showContextMenu = false;
    },

    // 复制单个文件到剪贴板（只读用户/游客禁止：复制后粘贴是写操作）
    copyFile(fileKey) {
      if (this.isGuest || this.isReadOnlyUser) {
        this.showCustomToast(this.isReadOnlyUser ? '只读用户无法复制文件' : '请先登录', 'error');
        this.showContextMenu = false;
        return;
      }
      this.clipboard = fileKey;
      this.clipboardIsCut = false;
      this.showCustomToast('已复制到剪贴板', 'success');
      // 关闭右键菜单
      this.showContextMenu = false;
    },

    // 剪切：把 key（文件或文件夹标记，如 openclaw/Wechat/_$folder$）放进剪贴板，
    // 粘贴时移动（先复制后删除）；文件夹只能单选剪切（文件夹不可多选）
    cutFile(fileKey) {
      if (this.isGuest || this.isReadOnlyUser) {
        this.showCustomToast(this.isReadOnlyUser ? '只读用户无法剪切文件' : '请先登录', 'error');
        this.showContextMenu = false;
        return;
      }
      this.clipboard = fileKey;
      this.clipboardIsCut = true;
      this.showCustomToast('已剪切，粘贴后将移动到目标目录（按 ESC 取消）', 'success');
      // 关闭右键菜单
      this.showContextMenu = false;
    },

    async copyPaste(source, target) {
      const uploadUrl = `/api/write/items/${apiPath(target)}`;

      // 准备请求头
      const headers = {
        "x-amz-copy-source": encodeURIComponent(source),
        "Content-Type": "application/octet-stream",
        // F3：服务端撞名保护（目标已存在时返回 412，不覆盖）
        "If-None-Match": "*"
      };
      const savedCredentials = localStorage.getItem('authCredentials');
      if (savedCredentials) {
        headers['Authorization'] = `Basic ${savedCredentials}`;
      }

      console.log('🔄 copyPaste 开始:', { source, target, uploadUrl });

      try {
        const response = await fetch(uploadUrl, {
          method: 'PUT',
          headers: headers,
          body: ""
        });

        console.log('🔄 copyPaste 响应:', {
          status: response.status,
          statusText: response.statusText,
          ok: response.ok
        });

        // 检查响应状态
        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            // 抛出特殊的权限错误，让调用方处理
            const authError = new Error(`权限不足：无法写入到目标路径 ${target}`);
            authError.isAuthError = true;
            authError.status = response.status;
            console.log('🔒 copyPaste 权限错误:', authError);
            throw authError;
          }
          if (response.status === 412) {
            // F3：目标已存在（服务端拒绝覆盖）。调用方据此决定是改名重试
            // （单文件粘贴）还是记为复制失败（文件夹内文件）。
            const conflictError = new Error(`目标已存在：${target}`);
            conflictError.isConflict = true;
            conflictError.status = 412;
            throw conflictError;
          }
          // 其他HTTP错误
          const httpError = new Error(`请求失败：HTTP ${response.status} ${response.statusText}`);
          console.log('❌ copyPaste HTTP错误:', httpError);
          throw httpError;
        }

        console.log('✅ copyPaste 成功完成');
      } catch (error) {
        console.log('❌ copyPaste 捕获错误:', error);

        // 如果已经是我们的权限错误，直接抛出
        if (error.isAuthError) {
          throw error;
        }

        // F3：412 撞名错误直接抛出（带 isConflict 标记），调用方据此改名重试或记为失败
        if (error.isConflict) {
          throw error;
        }

        // 检查是否是网络错误导致的权限问题
        if (error.message && (error.message.includes('401') || error.message.includes('403'))) {
          const authError = new Error(`权限不足：无法写入到目标路径 ${target}`);
          authError.isAuthError = true;
          authError.originalError = error;
          throw authError;
        }

        // 网络错误或其他错误
        const generalError = new Error(`复制粘贴失败: ${error.message}`);
        generalError.originalError = error;
        throw generalError;
      }
    },

    // 删除文件的统一方法
    async deleteFile(key) {
      const deleteUrl = `/api/write/items/${apiPath(key)}`;

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
          throw new Error(`请求失败：HTTP ${response.status} ${response.statusText}`);
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
        // 撞名自动改名（与粘贴一致）：以当前文件夹列表为准
        const usedNames = new Set();
        for (const d of this.folders) usedNames.add(d.replace(/\/$/, '').split('/').pop() + '/');
        const resolved = this.resolveAutoName(folderName, true, usedNames);
        const uploadUrl = `/api/write/items/${apiPath(this.cwd + resolved.name + '/_$folder$')}`;
        await axios.put(uploadUrl, "");
        this.fetchFiles();
        if (resolved.renamed) {
          this.showCustomToast(`文件夹已存在，已自动改名为 "${resolved.name}"`, 'warning');
        }
      } catch (error) {
        if (error === null) return; // 用户取消
        this.showCustomToast('创建文件夹失败: ' + (error.message || '未知错误'), 'error');
      }
    },

    // M6：按 marker 循环拉完所有页（每页最多 2 万个对象）；超过 10 页
    // （20 万个对象）时停止并提示截断，不再静默显示不完整列表。
    async fetchFiles() {
      this.files = [];
      this.folders = [];
      this.loading = true;
      // 导航/刷新时查当前目录的写权限，决定是否显示粘贴按钮（B5；不阻塞列表加载）
      this.refreshWritePermission();
      this.needLogin = false;
      this.listTruncated = false;

      // 准备请求头
      const headers = {};
      const savedCredentials = localStorage.getItem('authCredentials');
      if (savedCredentials) {
        headers['Authorization'] = `Basic ${savedCredentials}`;
      }

      try {
        let marker = null;
        const allFiles = [];
        const folderSet = new Set();
        for (let page = 0; page < 10; page++) {
          const url = new URL(`/api/children/${apiPath(this.cwd)}`, window.location.origin);
          if (marker) url.searchParams.set('marker', marker);
          const res = await fetch(url, { headers });
          const data = await res.json();
          if (data.needLogin) {
            // N9：带了凭据还被当成访客，说明存着的凭据已经失效（改了密码/
            // 删了账户）——不清掉的话每次导航都按失败记一次数，5 次后 IP
            // 被封 30 分钟，连正确密码都登不上。清掉本地凭据；needLogin
            // 本身就会显示登录提示（不用另外弹框）。
            // R3-3：needLogin 不只代表凭据错——有合法登录但无权进当前目录
            // 时也会返回 needLogin。只在服务端确认凭据确实错了
            // （badCredentials）且本地存的值仍等于发送的值时才清；
            // 否则一个 ?p=<无权目录> 的链接会把正常用户登出，被封时
            // 凭据也会被误删；飞行中的旧请求也不会清掉刚换上的新凭据。
            if (data.badCredentials && savedCredentials && localStorage.getItem('authCredentials') === savedCredentials) {
              localStorage.removeItem('authCredentials');
            }
            this.needLogin = true;
            this.isLoggedIn = false;
            this.isGuest = true;
            this.loading = false;
            return;
          }
          this.needLogin = false;
          this.registerRawToken(data);
          allFiles.push(...(data.value || []));
          for (const f of (data.folders || [])) folderSet.add(f);
          this.isGuest = data.isGuest || false;
          this.guestDirs = data.guestDirs || [];
          this.isLoggedIn = !this.isGuest;
          if (!data.marker) { marker = null; break; }
          marker = data.marker;
        }
        if (marker) this.listTruncated = true;
        this.files = allFiles;
        this.folders = [...folderSet];

        if (this.order) {
          this.files.sort((a, b) => {
            if (this.order === "size") {
              return b.size - a.size;
            }
          });
        }
        this.loading = false;
      } catch (error) {
        console.error('获取文件列表失败:', error);
        this.loading = false;
      }
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
      this.closeChangePasswordForm();
    },

    // 打开修改密码表单
    openChangePasswordForm() {
      this.showChangePasswordForm = true;
      this.changePasswordError = '';
      this.changePasswordSuccess = '';
      this.changePasswordForm.oldPassword = '';
      this.changePasswordForm.newPassword = '';
      this.changePasswordForm.confirmPassword = '';
    },

    // 关闭修改密码表单，回到用户信息面板
    closeChangePasswordForm() {
      this.showChangePasswordForm = false;
      this.changePasswordError = '';
      this.changePasswordSuccess = '';
      this.changePasswordLoading = false;
    },

    // 处理修改密码
    async handleChangePassword() {
      this.changePasswordError = '';
      this.changePasswordSuccess = '';

      const { oldPassword, newPassword, confirmPassword } = this.changePasswordForm;

      if (newPassword.length < 6) {
        this.changePasswordError = '新密码长度至少为6位';
        return;
      }
      if (newPassword !== confirmPassword) {
        this.changePasswordError = '两次输入的新密码不一致';
        return;
      }
      if (newPassword === oldPassword) {
        this.changePasswordError = '新密码不能与当前密码相同';
        return;
      }

      this.changePasswordLoading = true;

      try {
        const username = this.currentUser && this.currentUser.username;
        const credentials = btoa(`${username}:${oldPassword}`);

        const response = await fetch('/api/auth/change-password', {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache'
          },
          body: JSON.stringify({ oldPassword, newPassword })
        });

        const data = await response.json();

        if (data.success) {
          this.changePasswordSuccess = data.message || '密码修改成功，请重新登录';
          // 密码已变更，旧的登录态不再有效，2秒后自动退出登录，要求用新密码重新登录
          setTimeout(() => {
            this.logout();
          }, 2000);
        } else {
          this.changePasswordError = data.message || '密码修改失败';
        }
      } catch (error) {
        this.changePasswordError = '密码修改失败，请重试';
        console.error('修改密码错误:', error);
      } finally {
        this.changePasswordLoading = false;
      }
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
          // 处理登录失败，包括限制相关的错误
          this.loginError = data.message || '登录失败';

          // 如果用户被封禁，显示特殊样式
          if (data.banned) {
            this.loginError = `🔒 ${this.loginError}`;
          } else if (data.remainingAttempts !== undefined && data.remainingAttempts < 5) {
            // 如果剩余尝试次数较少，给出警告
            this.loginError += ` ⚠️`;
          }
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

    // 自定义确认对话框
    showConfirmPrompt(title, message, options = {}) {
      return new Promise((resolve, reject) => {
        this.confirmDialog = {
          title,
          message,
          type: options.type || 'default',
          confirmText: options.confirmText || '确定',
          cancelText: options.cancelText || '取消',
          resolve,
          reject
        };
        this.showConfirmDialog = true;
      });
    },

    confirmAction() {
      if (this.confirmDialog.resolve) {
        this.confirmDialog.resolve(true);
      }
      this.showConfirmDialog = false;
    },

    cancelConfirm() {
      if (this.confirmDialog.reject) {
        this.confirmDialog.reject(false);
      }
      this.showConfirmDialog = false;
    },

    // 多选功能相关方法
    toggleMultiSelectMode() {
      this.isMultiSelectMode = !this.isMultiSelectMode;
      if (!this.isMultiSelectMode) {
        this.selectedFiles = [];
      }
    },



    isFileSelected(fileKey) {
      return this.selectedFiles.includes(fileKey);
    },

    toggleFileSelection(fileKey) {
      const index = this.selectedFiles.indexOf(fileKey);
      if (index > -1) {
        // 文件已选中，取消选择
        this.selectedFiles.splice(index, 1);
      } else {
        // 文件未选中，添加到选择列表
        this.selectedFiles.push(fileKey);
      }
    },

    selectAllFiles() {
      if (this.selectedFiles.length === this.filteredFiles.length) {
        // 取消全选
        this.selectedFiles = [];
      } else {
        // 全选
        this.selectedFiles = this.filteredFiles.map(file => file.key);
      }
    },

    // 批量操作方法
    async batchDownload() {
      if (this.selectedFiles.length === 0) return;

      try {
        for (const fileKey of this.selectedFiles) {
          const link = document.createElement('a');
          link.href = await this.perFileUrl(fileKey);
          link.download = fileKey.split('/').pop();
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          // 添加小延迟避免浏览器阻止多个下载
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        this.showCustomToast(`开始下载 ${this.selectedFiles.length} 个文件`, 'success');
      } catch (error) {
        this.showCustomToast('批量下载失败: ' + error.message, 'error');
      }
    },

    batchCopy() {
      if (this.selectedFiles.length === 0) return;

      // 复制操作不需要写权限，只是复制到剪贴板
      this.clipboard = this.selectedFiles.length === 1 ? this.selectedFiles[0] : this.selectedFiles;
      this.clipboardIsCut = false;
      this.showCustomToast(`已复制 ${this.selectedFiles.length} 个文件到剪贴板`, 'success');
    },

    // 批量剪切：把选中的文件放进剪贴板，粘贴时移动（先复制后删除）
    batchCut() {
      if (this.selectedFiles.length === 0) return;

      if (this.isGuest || this.isReadOnlyUser) {
        this.showCustomToast(this.isReadOnlyUser ? '只读用户无法剪切文件' : '请先登录', 'error');
        return;
      }

      this.clipboard = this.selectedFiles.length === 1 ? this.selectedFiles[0] : this.selectedFiles;
      this.clipboardIsCut = true;
      this.showCustomToast(`已剪切 ${this.selectedFiles.length} 个文件，粘贴后将移动（按 ESC 取消）`, 'success');
    },

    async batchDelete() {
      if (this.selectedFiles.length === 0) return;

      // 检查写权限
      if (!this.canWrite) {
        this.showPermissionDialog('删除文件');
        return;
      }

      try {
        const fileNames = this.selectedFiles.map(key => key.split('/').pop()).join('、');
        const confirmed = await this.showConfirmPrompt(
          '批量删除文件',
          `确定要删除以下 ${this.selectedFiles.length} 个文件吗？\n\n${fileNames}\n\n此操作无法撤销。`,
          { type: 'danger', confirmText: '删除', cancelText: '取消' }
        );

        if (!confirmed) return;

        let successCount = 0;
        let failCount = 0;

        for (const fileKey of this.selectedFiles) {
          try {
            await this.deleteFile(fileKey);
            successCount++;
          } catch (error) {
            console.error(`删除文件 ${fileKey} 失败:`, error);
            failCount++;
          }
        }

        // 清空选择并刷新文件列表
        this.selectedFiles = [];
        this.fetchFiles();

        if (failCount === 0) {
          this.showCustomToast(`成功删除 ${successCount} 个文件`, 'success');
        } else {
          this.showCustomToast(`删除完成：成功 ${successCount} 个，失败 ${failCount} 个`, 'warning');
        }

      } catch (error) {
        if (error === false) return; // 用户取消

        console.error('批量删除失败:', error);
        if (error.isAuthError) {
          this.showPermissionDialog('删除文件');
        } else {
          this.showCustomToast('批量删除失败: ' + (error.message || '未知错误'), 'error');
        }
      }
    },

    // 键盘快捷键处理
    handleKeyDown(event) {
      // Ctrl+A 或 Cmd+A：切换多选模式
      if ((event.ctrlKey || event.metaKey) && event.key === 'a' && !event.target.matches('input, textarea')) {
        event.preventDefault();
        this.toggleMultiSelectMode();
        return;
      }

      // Ctrl+V 或 Cmd+V：粘贴文件
      if ((event.ctrlKey || event.metaKey) && event.key === 'v' && !event.target.matches('input, textarea') && this.clipboard) {
        event.preventDefault();
        this.pasteFile();
        return;
      }

      // Ctrl+X 或 Cmd+X：剪切选中的文件（仅多选模式；单文件剪切走右键菜单）
      if ((event.ctrlKey || event.metaKey) && event.key === 'x' && !event.target.matches('input, textarea') && this.selectedFiles.length > 0) {
        event.preventDefault();
        this.batchCut();
        return;
      }

      // Escape：先关闭打开的菜单/右键菜单/上传弹窗，再取消剪贴板，最后退出多选模式（D4）
      if (event.key === 'Escape') {
        if (this.showMenu) {
          this.showMenu = false;
          return;
        }
        if (this.showContextMenu) {
          this.showContextMenu = false;
          return;
        }
        if (this.showUploadPopup) {
          this.showUploadPopup = false;
          return;
        }
        if (this.showShareDialog) {
          this.showShareDialog = false;
          return;
        }
        if (this.showSharesDialog) {
          this.showSharesDialog = false;
          return;
        }
        if (this.showFetchDialog && !this.fetchDialog.loading) {
          this.showFetchDialog = false;
          return;
        }
        if (this.clipboard) {
          // 先取消剪贴板（剪切/复制待粘贴状态），并退出多选模式
          this.clearClipboard();
          return;
        }
        if (this.isMultiSelectMode) {
          this.isMultiSelectMode = false;
          this.selectedFiles = [];
          return;
        }
      }

      // Delete：删除选中的文件
      if (event.key === 'Delete' && this.selectedFiles.length > 0) {
        event.preventDefault();
        this.batchDelete();
        return;
      }
    },

    // 初始化粘贴按钮位置
    initPasteButtonPosition() {
      // v21：桌面端宽版放右侧边缘；移动端 56px 小方块放右侧中部
      if (this.isMobile) {
        this.pasteButtonPosition = {
          x: window.innerWidth - 56 - 16,
          y: Math.round(window.innerHeight * 0.4)
        };
      } else {
        this.pasteButtonPosition = {
          x: window.innerWidth - 240,
          y: 120
        };
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

      // 限制在视窗范围内（v21：移动端按钮 56px）
      const buttonWidth = this.isMobile ? 56 : 120;
      const buttonHeight = this.isMobile ? 56 : 60;
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

      // 桌面端智能吸附到边缘
      if (!this.isMobile && this.hasMoved) {
        this.snapToEdge();
      }

      // 延迟重置状态
      setTimeout(() => {
        this.isDraggingPasteButton = false;
        this.hasMoved = false;
      }, 100);
    },

    // 拖拽结束后的智能吸附
    snapToEdge() {
      const windowWidth = window.innerWidth;
      const buttonWidth = 220;
      const margin = 20;

      // 吸附到最近的边缘
      if (this.pasteButtonPosition.x < windowWidth / 2) {
        // 吸附到左边
        this.pasteButtonPosition.x = margin;
      } else {
        // 吸附到右边
        this.pasteButtonPosition.x = windowWidth - buttonWidth - margin;
      }

      // 确保不超出屏幕边界
      this.pasteButtonPosition.y = Math.max(80, Math.min(this.pasteButtonPosition.y, window.innerHeight - 100));
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
        this.showCustomToast('粘贴文件失败: ' + (error.message || error), 'error');
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
        case "管理分享链接":
          this.openSharesDialog();
          return; // 管理操作不需要排序
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

    // F5：预览/下载用的单文件链接。不要直接用 rawUrl 的目录级令牌——
    // 地址栏/下载链接里的目录令牌能读整个目录（12 小时内有效）。
    // 向 /api/sign 申请只对这一个文件有效的令牌；失败时回退到目录令牌。
    // 只读用户调 /api/sign 会 403（签名链接属于写操作），直接用目录令牌
    // （他们本来就能读这个目录）；访客目录文件走 /api/sign 返回公开直链。
    // N4：令牌只给 10 分钟——够打开/下载，地址栏里抄走的链接一周后就
    // 失效了（/api/sign 默认是 7 天）。
    async perFileUrl(key) {
      if (this.isReadOnlyUser) return this.rawUrl(key);
      try {
        const res = await axios.post('/api/sign', { key, expiresIn: 600 });
        if (res?.data?.url) return res.data.url;
      } catch (error) {
        // 回退到目录令牌（例如未登录、网络异常）
      }
      return this.rawUrl(key);
    },

    // F5：非媒体文件的新标签页预览。先同步打开一个空白页（在用户手势内，
    // 不会被拦截），拿到单文件令牌后再导航过去；直接 await 再 window.open
    // 会被浏览器当成弹窗拦截。
    async previewFile(key) {
      const win = window.open('', '_blank');
      try {
        const url = await this.perFileUrl(key);
        if (win) {
          win.location.href = url;
        } else {
          window.open(url, '_blank');
        }
      } catch (error) {
        if (win) win.close();
        this.showCustomToast('打开预览失败: ' + (error.message || '未知错误'), 'error');
      }
    },

    // 处理文件点击（区分搜索结果和普通文件）
    handleFileClick(file) {
      // 如果处于多选模式，点击文件切换选择状态
      if (this.isMultiSelectMode) {
        this.toggleFileSelection(file.key);
        return;
      }

      // 检查是否是媒体文件
      const imageTypes = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'];
      const videoTypes = ['mp4', 'webm', 'ogv', 'avi', 'mov', 'wmv'];
      const audioTypes = ['m4a', 'mp3', 'flac', 'wav', 'ogg', 'aac', 'opus', 'wma'];
      const ext = file.key?.split('.').pop()?.toLowerCase();
      const isImageFile = imageTypes.includes(ext);
      const isVideoFile = videoTypes.includes(ext);
      const isAudioFile = audioTypes.includes(ext);
      const isMediaFile = isImageFile || isVideoFile || isAudioFile;

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
        // 普通非媒体文件：直接预览/下载（单文件令牌，不用目录令牌）
        this.previewFile(file.key);
      }
    },

    // 打开媒体预览
    openMediaPreview(clickedFile) {
      // 确定点击文件的类型
      const imageTypes = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'];
      const videoTypes = ['mp4', 'webm', 'ogv', 'avi', 'mov', 'wmv'];
      const audioTypes = ['m4a', 'mp3', 'flac', 'wav', 'ogg', 'aac', 'opus', 'wma'];
      const clickedExt = clickedFile.key?.split('.').pop()?.toLowerCase();
      const isClickedImage = imageTypes.includes(clickedExt);
      const isClickedVideo = videoTypes.includes(clickedExt);
      const isClickedAudio = audioTypes.includes(clickedExt);

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
          } else if (isClickedAudio) {
            return audioTypes.includes(ext);
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
          } else if (isClickedAudio) {
            return audioTypes.includes(ext);
          }
          return false;
        });
      }

      // 为每个媒体文件添加预览URL
      mediaList = mediaList.map(file => ({
        ...file,
        url: this.rawUrl(file.key),
        name: file.key.split('/').pop(),
        size: file.size
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

    // —— 剪贴板辅助 ——

    // 剪贴板内容显示文本（个数或文件名）
    clipboardLabel() {
      if (!this.clipboard) return '';
      return Array.isArray(this.clipboard) ? `${this.clipboard.length} 个文件` : this.displayNameForKey(this.clipboard);
    },

    // 该 key 是否在剪切集合里（用于置灰显示）
    isCutFile(key) {
      if (!this.clipboardIsCut || !this.clipboard) return false;
      return Array.isArray(this.clipboard) ? this.clipboard.includes(key) : this.clipboard === key;
    },

    // 清空剪贴板（取消剪切/复制），并退出多选模式（A7/A8）
    clearClipboard() {
      this.clipboard = null;
      this.clipboardIsCut = false;
      if (this.isMultiSelectMode) {
        this.isMultiSelectMode = false;
        this.selectedFiles = [];
      }
    },

    // 检查指定目录的写权限（B5：导航时查，粘贴按钮与 pasteFile 以此为准）
    async checkWritePermission(path) {
      try {
        const headers = { 'Content-Type': 'application/json' };
        const savedCredentials = localStorage.getItem('authCredentials');
        if (savedCredentials) {
          headers['Authorization'] = `Basic ${savedCredentials}`;
        }
        const response = await fetch('/api/auth/check-write-permission', {
          method: 'POST',
          headers,
          body: JSON.stringify({ path })
        });
        const result = await response.json();
        return !!result.hasPermission;
      } catch (error) {
        console.error('检查写权限失败:', error);
        return false;
      }
    },

    // 刷新当前目录的写权限（导航/刷新时调用；不阻塞列表加载；
    // 若导航已换目录，过期结果直接丢弃）
    async refreshWritePermission() {
      const path = this.cwd;
      const ok = await this.checkWritePermission(path);
      if (this.cwd === path) {
        this.canWriteHere = ok;
      }
    },

    // —— 剪切/粘贴辅助 ——

    // 取 key 的显示名：文件为文件名，文件夹标记为文件夹名
    displayNameForKey(key) {
      if (key.endsWith('_$folder$')) {
        return key.slice(0, -9).split('/').filter(Boolean).pop() || key;
      }
      return key.split('/').pop();
    },

    // 取 key 所在的目录（含尾部 /，根目录为 ''）
    // 文件夹标记取其父目录（如 openclaw/Wechat/_$folder$ → openclaw/）
    parentDirOfKey(key) {
      const path = key.endsWith('_$folder$') ? key.slice(0, -9) : key;
      const trimmed = path.replace(/\/$/, '');
      const slash = trimmed.lastIndexOf('/');
      return slash === -1 ? '' : trimmed.slice(0, slash + 1);
    },

    // 撞名自动改名（B4）：目标目录已有同名时，在名字后加 " (1)"、" (2)"… 直到不重名
    // usedNames：目标目录已有名称集合（文件为名，文件夹为名+'/'），本次已分配的名字也会加进去
    resolveAutoName(name, isFolder, usedNames) {
      const key = isFolder ? name + '/' : name;
      if (!usedNames.has(key)) {
        usedNames.add(key);
        return { name, renamed: false };
      }
      // 拆分文件名和扩展名（无扩展名、或以 . 开头的文件，整体视为名字）
      let base = name, ext = '';
      if (!isFolder) {
        const dot = name.lastIndexOf('.');
        if (dot > 0) {
          base = name.slice(0, dot);
          ext = name.slice(dot);
        }
      }
      let i = 1;
      for (;;) {
        const candidate = isFolder ? `${base} (${i})` : `${base} (${i})${ext}`;
        const candidateKey = isFolder ? candidate + '/' : candidate;
        if (!usedNames.has(candidateKey)) {
          usedNames.add(candidateKey);
          return { name: candidate, renamed: true, original: name };
        }
        i++;
      }
    },

    // 递归复制/移动一个文件夹（B3/B6）
    // markerKey：源文件夹标记，如 openclaw/Wechat/_$folder$
    // targetFolderPath：目标文件夹路径，含尾部 /，如 openclaw/目标/Wechat (1)/
    // isMove：true=移动（复制后删源），false=复制
    // 返回 { total, failed: [{ key, stage: 'copy'|'delete'|'marker', error }], authAborted }
    // 标记策略（B6：不丢数据、可恢复）：
    //   全部成功 → 移动时删源标记（文件夹真正搬走），复制时只写目标标记；
    //   部分失败 → 目标标记照写（目标文件夹可见，已成功的内容在里面），
    //              移动时保留源标记（源文件夹仍可见，失败的项还在里面，可重试）；
    //   全部失败 → 不写目标标记（不留空文件夹），源标记保留。
    // 注意：旧版 moveFile 的文件夹名取法有误（'_$folder$'.slice(0,-9) === ''），
    // 会把文件夹内容摊平到目标目录；这里用 displayNameForKey 正确取名。
    async transferFolder(markerKey, targetFolderPath, isMove) {
      const sourceBasePath = markerKey.slice(0, -9); // 含尾部 /，如 openclaw/Wechat/
      const allItems = await this.getAllItems(sourceBasePath);
      const total = allItems.length;
      const failed = [];
      let authAborted = false;
      let processed = 0;

      this.uploadFileName = isMove ? '正在移动文件夹…' : '正在复制文件夹…';
      if (total > 0) this.uploadProgress = 0;
      try {
        for (const item of allItems) {
          const relativePath = item.key.substring(sourceBasePath.length);
          const newPath = targetFolderPath + relativePath;
          try {
            await this.copyPaste(item.key, newPath);
            if (isMove) {
              try {
                await this.deleteFile(item.key);
              } catch (delError) {
                // 复制成功但删除失败：文件两处都有，单独记一类，不算复制失败
                failed.push({ key: item.key, stage: 'delete', error: delError });
              }
            }
          } catch (error) {
            if (error.isAuthError) {
              authAborted = true;
              break;
            }
            failed.push({ key: item.key, stage: 'copy', error });
          }
          processed++;
          if (total > 0) this.uploadProgress = (processed / total) * 100;
        }
      } finally {
        this.uploadProgress = null;
        this.uploadFileName = '';
      }

      // 标记处理（见上 B6 策略）
      const copyFailedCount = failed.filter(f => f.stage === 'copy' || f.stage === 'marker').length;
      const succeededCount = total - copyFailedCount;
      const targetMarkerKey = targetFolderPath + '_$folder$';
      if (succeededCount > 0 && !authAborted) {
        try {
          await this.copyPaste(markerKey, targetMarkerKey);
          if (isMove && copyFailedCount === 0) {
            // 全部成功才删源标记；部分失败时保留源标记以便重试
            await this.deleteFile(markerKey);
          }
        } catch (markerError) {
          if (markerError.isAuthError) {
            authAborted = true;
          }
          failed.push({ key: markerKey, stage: 'marker', error: markerError });
        }
      }
      return { total, failed, authAborted };
    },

    async pasteFile() {
      // v20 防重入：粘贴进行中时，按钮、菜单、Ctrl+V 再触发都直接忽略
      if (this.isPasting) return;
      if (!this.clipboard) return;

      // 写权限：以当前目录的查权限结果为准（导航时查过；后端仍会兜底报 401/403）
      if (!this.canWrite || !this.canWriteHere) {
        this.showPermissionDialog('粘贴文件');
        return;
      }

      // 关闭右键菜单
      this.showContextMenu = false;

      const isCut = this.clipboardIsCut;
      const verb = isCut ? '移动' : '粘贴';
      const items = Array.isArray(this.clipboard) ? [...this.clipboard] : [this.clipboard];

      // v20：从这里起进入执行阶段（后面的确认框、改名输入框都是 await，
      // 标志必须在它们之前就置上，否则连点会在弹框期间溜进来第二遍）；
      // 标志在 finally 里清除，任何提前返回/报错都不会卡住
      this.isPasting = true;
      try {
        // N3：把目标目录快照下来——粘贴执行中有 await，期间用户仍可导航；
        // 后面一律用 targetDir，不再现读 this.cwd，否则剩余的项会被写到
        // 新目录去（剪切还会把源删掉，等于悄悄移错了地方）。
        const targetDir = this.cwd;
        // 目标目录现有名称（粘贴目标就是 targetDir；文件为名，文件夹为名+'/'）。
        // 以粘贴开始时的列表为准；若列表过期，极少数情况下撞名可能漏判，
        // 后端 412 会兜底——不要在列表未加载完时粘贴。
        const usedNames = new Set();
        for (const f of this.files) usedNames.add(f.key.split('/').pop());
        for (const d of this.folders) usedNames.add(d.replace(/\/$/, '').split('/').pop() + '/');

        // B1 同目录粘贴保护（仅剪切）：源目录 == 当前目录时粘贴等于没动，
        // 且后续删除会把源文件删掉，必须跳过
        // B2 文件夹移入自身/子孙保护：目标在文件夹内部时跳过
        const skipped = [];
        const todo = [];
        for (const key of items) {
          const name = this.displayNameForKey(key);
          const isFolder = key.endsWith('_$folder$');
          if (isCut && this.parentDirOfKey(key) === targetDir) {
            skipped.push({ name, reason: '已在当前目录' });
            continue;
          }
          if (isFolder) {
            const folderPath = key.slice(0, -9);
            if (targetDir === folderPath || targetDir.startsWith(folderPath)) {
              skipped.push({ name, reason: '不能移入自身或子目录' });
              continue;
            }
          }
          todo.push({ key, name, isFolder });
        }

        if (todo.length === 0) {
          const msg = skipped.map(s => `${s.name}（${s.reason}）`).join('；');
          this.showCustomToast(`无法${verb}：${msg}`, 'warning');
          return;
        }

        // 确认：多项时问一声；单项复制走改名输入框（保留原行为）；单项剪切不问
        let singleCopyName = null;
        if (todo.length > 1) {
          const confirmed = await this.showConfirmPrompt(
            isCut ? '批量移动文件' : '批量粘贴文件',
            `确定要${verb} ${todo.length} 个文件到当前目录吗？`,
            { confirmText: verb, cancelText: '取消' }
          );
          if (!confirmed) return;
        } else if (!isCut) {
          const defaultName = todo[0].name;
          const newName = await this.showInputPrompt('粘贴文件', '重命名为:', defaultName);
          if (newName === null || newName === undefined) return;
          singleCopyName = newName === '' ? defaultName : newName;
        }

        // 执行
        let succeeded = 0;
        const copyFailed = []; // { name }：复制失败（源文件还在原处）
        const deleteFailed = []; // { name }：已复制但源文件未删除（两处都有）
        const renamed = []; // { from, to }：撞名自动改名的项
        const folderNotes = []; // 文件夹未完成时的说明
        let authAborted = false;
        const failedKeys = []; // 剪切部分失败时保留在剪贴板里以便重试（仅复制失败的项）

        for (let i = 0; i < todo.length; i++) {
          const item = todo[i];
          // B4 撞名自动改名（目标名可能被前面已分配的名字占用，也一并处理）
          const resolved = this.resolveAutoName(
            item.isFolder ? item.name : (singleCopyName || item.name),
            item.isFolder,
            usedNames
          );
          if (resolved.renamed) renamed.push({ from: resolved.original, to: resolved.name });

          if (item.isFolder) {
            const targetFolderPath = `${targetDir}${resolved.name}/`;
            const result = await this.transferFolder(item.key, targetFolderPath, isCut);
            if (result.authAborted) {
              authAborted = true;
              failedKeys.push(...todo.slice(i + 1).map(t => t.key));
              break;
            }
            const itemCopyFailed = result.failed.filter(f => f.stage === 'copy' || f.stage === 'marker');
            const itemDeleteFailed = result.failed.filter(f => f.stage === 'delete');
            if (itemCopyFailed.length === 0) {
              succeeded++;
            } else {
              copyFailed.push({ name: item.name });
              failedKeys.push(item.key);
              folderNotes.push(`${item.name} 未能完整${verb}：${itemCopyFailed.length} 个文件失败，源文件夹仍保留，可重试`);
            }
            for (const f of itemDeleteFailed) {
              deleteFailed.push({ name: this.displayNameForKey(f.key) });
            }
          } else {
            // F3：单文件粘贴。copyPaste 发 If-None-Match: *，目标已存在时返回
            // 412（isConflict）；此时重新算一个名字再试，最多 3 次，仍撞就记为失败。
            let targetName = resolved.name;
            let copied = false;
            for (let attempt = 0; attempt < 3 && !copied; attempt++) {
              const targetFile = `${targetDir}${targetName}`;
              try {
                await this.copyPaste(item.key, targetFile);
                copied = true;
              } catch (error) {
                if (error.isAuthError) {
                  authAborted = true;
                  failedKeys.push(...todo.slice(i + 1).map(t => t.key));
                  break;
                }
                if (error.isConflict && attempt < 2) {
                  usedNames.add(targetName);
                  const r = this.resolveAutoName(item.name, false, usedNames);
                  if (r.renamed) renamed.push({ from: targetName, to: r.name });
                  targetName = r.name;
                  continue;
                }
                copyFailed.push({ name: item.name });
                failedKeys.push(item.key);
                break;
              }
            }
            if (copied) {
              succeeded++;
              if (isCut) {
                try {
                  await this.deleteFile(item.key);
                } catch (delError) {
                  if (delError.isAuthError) {
                    authAborted = true;
                    failedKeys.push(...todo.slice(i + 1).map(t => t.key));
                    break;
                  }
                  // 复制成功但删除失败：文件两处都有，单独上报，不保留进剪贴板（重试会重复复制）
                  deleteFailed.push({ name: item.name });
                }
              }
            }
            if (authAborted) break;
          }
        }

        this.fetchFiles();

        // 剪切是一次性的：全部成功则清空剪贴板；部分失败则只保留失败项以便重试
        if (isCut) {
          if (copyFailed.length === 0 && deleteFailed.length === 0 && !authAborted) {
            this.clearClipboard();
          } else if (failedKeys.length > 0) {
            this.clipboard = failedKeys.length === 1 ? failedKeys[0] : failedKeys;
            this.clipboardIsCut = true;
          }
        }

        if (authAborted) {
          this.showPermissionDialog(isCut ? '移动文件' : '粘贴文件');
          this.showCustomToast(`权限不足，已停止${verb}：成功 ${succeeded} 个，失败 ${copyFailed.length} 个`, 'warning');
          return;
        }

        // 结果汇总
        const parts = [];
        if (succeeded > 0) parts.push(`成功 ${succeeded} 个`);
        if (copyFailed.length > 0) parts.push(`失败 ${copyFailed.length} 个`);
        if (deleteFailed.length > 0) parts.push(`${deleteFailed.length} 个已复制但源文件未删除（两处都有）`);
        let msg = `${verb}完成：${parts.join('，')}`;
        if (renamed.length > 0) {
          const list = renamed.slice(0, 3).map(r => `${r.from} → ${r.to}`).join('、');
          msg += `；以下因重名已自动改名：${list}${renamed.length > 3 ? ` 等 ${renamed.length} 个` : ''}`;
        }
        if (skipped.length > 0) {
          const list = skipped.slice(0, 3).map(s => `${s.name}（${s.reason}）`).join('、');
          msg += `；已跳过：${list}${skipped.length > 3 ? ` 等 ${skipped.length} 个` : ''}`;
        }
        if (folderNotes.length > 0) {
          msg += `；${folderNotes.join('；')}`;
        }
        if (copyFailed.length === 0 && deleteFailed.length === 0) {
          this.showCustomToast(msg, 'success');
        } else if (succeeded === 0) {
          this.showCustomToast(msg, 'error', 5000);
        } else {
          this.showCustomToast(msg, 'warning', 5000);
        }
      } catch (error) {
        if (error === null || error === false) return; // 用户取消

        // 检查是否是权限错误
        if (error.isAuthError) {
          // 显示友好的权限提示，并提供登录选项
          this.showPermissionDialog();
          return;
        }

        console.error('粘贴文件失败:', error);
        this.showCustomToast('粘贴文件失败: ' + (error.message || '未知错误'), 'error');
      } finally {
        this.isPasting = false;
      }
    },

    // 显示自定义提示
    showCustomToast(message, type = 'success', duration = 3000) {
      this.toastMessage = message;
      this.toastType = type;
      this.showToast = true;

      setTimeout(() => {
        this.showToast = false;
      }, duration);
    },

    // 显示权限对话框
    showPermissionDialog(operation = '粘贴文件') {
      const message = this.isLoggedIn
        ? `您没有权限在此目录${operation}。可能需要更高级别的权限或者此目录为只读。`
        : `您需要登录才能在此目录${operation}。`;

      const action = this.isLoggedIn ? '确定' : '立即登录';

      this.showConfirmPrompt(
        '权限提示',
        `${message}\n\n点击"${action}"${this.isLoggedIn ? '' : '进行身份验证'}`,
        { confirmText: action, cancelText: '取消' }
      ).then((confirmed) => {
        if (confirmed && !this.isLoggedIn) {
          this.showLoginModal();
        }
      }).catch(() => {
        // 用户取消，不做任何操作
      });
    },

    async processUploadQueue() {
      if (!this.uploadQueue.length) {
        this.fetchFiles();
        this.uploadProgress = null;
        this.uploadFileName = '';
        this.currentUpload = null;
        return;
      }

      /** @type File **/
      const { basedir, file, targetName } = this.uploadQueue.shift();
      // 上传用的实际文件名（撞名时已在入队时自动改名；无 targetName 时回退到原名）
      let uploadName = targetName || file.name;
      let thumbnailDigest = null;
      // 进度条按当前文件显示（M8）：每换一个文件重置百分比并显示文件名
      this.uploadFileName = uploadName;
      this.uploadProgress = 0;
      // F3：记下正在传的文件（名 + 目录），uploadFiles 算撞名时把它也算进去
      this.currentUpload = { basedir, name: uploadName };

      if (file.type.startsWith("image/") || file.type.startsWith("video/")) {
        try {
          const thumbnailBlob = await generateThumbnail(file);
          const digestHex = await blobDigest(thumbnailBlob);

          const thumbnailUploadUrl = `/api/write/items/${apiPath('_$flaredrive$/thumbnails/' + digestHex + '.png')}`;
          try {
            await axios.put(thumbnailUploadUrl, thumbnailBlob);
            thumbnailDigest = digestHex;
          } catch (error) {
            // 缩略图失败不阻断主文件上传，只记日志
            console.log(`Upload ${digestHex}.png failed`, error);
          }
        } catch (error) {
          console.log(`Generate thumbnail failed`);
        }
      }

      // F3：服务端撞名保护。每次尝试都发 If-None-Match: *（目标已存在时服务端
      // 返回 412，不覆盖）；412 时重新算一个名字再试，最多 3 次，仍撞就报错。
      // 缩略图是按内容摘要存的，与文件名无关，重试不用重新生成。
      // N6：把每次试过的名字都记在 tried 里——used 每轮都从 this.files 重建，
      // 只加当前名字会让重试撞回上轮刚撞过的名字（a.txt → a (1).txt → 又回
      // 到 a (1).txt），明明 a (2).txt 空着却传失败。
      let uploaded = false;
      let lastError = null;
      const tried = new Set();
      for (let attempt = 0; attempt < 3 && !uploaded; attempt++) {
        this.uploadFileName = uploadName;
        this.currentUpload = { basedir, name: uploadName };
        this.uploadProgress = 0;
        try {
          const uploadUrl = `/api/write/items/${apiPath(basedir + uploadName)}`;
          const headers = { "If-None-Match": "*" };
          const onUploadProgress = (progressEvent) => {
            var percentCompleted =
              (progressEvent.loaded * 100) / progressEvent.total;
            this.uploadProgress = percentCompleted;
          };
          if (thumbnailDigest) headers["fd-thumbnail"] = thumbnailDigest;
          if (file.size >= SIZE_LIMIT) {
            await multipartUpload(`${basedir}${uploadName}`, file, {
              headers,
              onUploadProgress,
              ifNoneMatch: true,
            });
          } else {
            await axios.put(uploadUrl, file, { headers, onUploadProgress });
          }
          uploaded = true;
        } catch (error) {
          lastError = error;
          if (error?.response?.status === 412 && attempt < 2) {
            tried.add(uploadName);
            const used = new Set(this.files.map((f) => f.key.split('/').pop()));
            for (const name of tried) used.add(name);
            for (const t of this.uploadQueue) {
              if (t.basedir === basedir) used.add(t.targetName || t.file.name);
            }
            uploadName = this.resolveAutoName(file.name, false, used).name;
            continue;
          }
          break;
        }
      }
      this.currentUpload = null;
      if (!uploaded) {
        // M8：上传失败要明确告诉用户是哪个文件、为什么失败（以前只写 console）
        const reason = lastError?.response?.data?.error || lastError?.message || '未知错误';
        this.showCustomToast(`上传失败："${uploadName}"（${reason}）`, 'error');
        console.log(`Upload ${uploadName} failed`, lastError);
      }
      setTimeout(this.processUploadQueue);
    },

    async removeFile(key) {
      // 检查写权限
      if (!this.canWrite) {
        this.showPermissionDialog('删除文件');
        return;
      }
      
      // 关闭右键菜单
      this.showContextMenu = false;

      try {
        const fileName = key.split('/').pop();
        const confirmed = await this.showConfirmPrompt(
          '删除文件',
          `确定要删除文件 "${fileName}" 吗？此操作无法撤销。`,
          { type: 'danger', confirmText: '删除', cancelText: '取消' }
        );
        if (!confirmed) return;

        await this.deleteFile(key);
        this.fetchFiles();
        this.showCustomToast(`文件 "${fileName}" 已删除`, 'success');
      } catch (error) {
        if (error === false) return; // 用户取消

        // 检查是否是权限错误
        if (error.isAuthError) {
          this.showPermissionDialog('删除文件');
          return;
        }
        console.error('删除失败:', error);
        this.showCustomToast('删除失败: ' + (error.message || '未知错误'), 'error');
      }
    },

    // 删除文件夹：此前这里只会删除 "_$folder$" 这个空标记文件，
    // 文件夹里实际的文件和子文件夹会被静默留下（既没被删掉，也脱离了正常管理）。
    // 现在改为先用 getAllItems 递归枚举文件夹下的全部内容（文件 + 子文件夹标记），
    // 逐个删除，最后再删除文件夹自身的标记，和"移动文件夹"用的是同一套递归逻辑。
    async removeFolder(folderPath) {
      // 检查写权限
      if (!this.canWrite) {
        this.showPermissionDialog('删除文件夹');
        return;
      }

      // 关闭右键菜单
      this.showContextMenu = false;

      const folderName = folderPath.split('/').filter(Boolean).pop() || folderPath;
      const folderMarkerKey = folderPath + '_$folder$';

      try {
        const confirmed = await this.showConfirmPrompt(
          '删除文件夹',
          `确定要删除文件夹 "${folderName}" 吗？文件夹内的所有文件和子文件夹都会被永久删除，此操作无法撤销。`,
          { type: 'danger', confirmText: '删除', cancelText: '取消' }
        );
        if (!confirmed) return;

        // 递归获取文件夹内的所有文件和子文件夹标记
        const allItems = await this.getAllItems(folderPath);

        const total = allItems.length;
        let done = 0;
        if (total > 0) this.uploadProgress = 0;
        if (total > 0) this.uploadFileName = `正在删除文件夹 "${folderName}"…`;

        for (const item of allItems) {
          try {
            await this.deleteFile(item.key);
          } catch (itemError) {
            // 权限错误直接中止整个删除流程并向上抛出
            if (itemError.isAuthError) throw itemError;
            // 单个文件删除失败不阻断整体流程，记录后继续删除其余文件，
            // 避免因为某一个文件失败导致整个文件夹删不掉
            console.error(`删除 ${item.key} 失败:`, itemError);
          }
          done++;
          if (total > 0) this.uploadProgress = (done / total) * 100;
        }

        // 最后删除文件夹自身的标记
        await this.deleteFile(folderMarkerKey);

        this.uploadProgress = null;
        this.uploadFileName = '';
        this.fetchFiles();
        this.showCustomToast(`文件夹 "${folderName}" 已删除`, 'success');
      } catch (error) {
        this.uploadProgress = null;
        this.uploadFileName = '';
        if (error === false) return; // 用户取消

        if (error.isAuthError) {
          this.showPermissionDialog('删除文件夹');
          return;
        }
        console.error('删除文件夹失败:', error);
        this.showCustomToast('删除文件夹失败: ' + (error.message || '未知错误'), 'error');
      }
    },

    // 根据文件名后缀判断这个文件是否是"重新生成缩略图"支持的类型
    guessMimeFromExtension(filename) {
      const ext = (filename || '').split('.').pop().toLowerCase();
      return EXT_MIME_MAP[ext] || null;
    },

    canRegenerateThumbnail(key) {
      return !!this.guessMimeFromExtension(key);
    },

    // 为已存在的文件重新生成缩略图，不需要重新上传整个文件。
    // 流程：只有存的 content-type 不对时才先修复（否则视频元素可能因类型错误
    // 加载失败）→ 直接用支持 Range 分段请求的网络地址生成缩略图（不需要先把
    // 整份文件下载到内存里，大文件明显更快）→ 上传缩略图小文件 →
    // 最后一次 fixMetadata 同时写回 contentType 和 thumbnail（M9：端点本来就
    // 支持两个字段，类型已正确时全程只有一次整文件重写）。
    // 顺带修复很多旧文件缺失的 content-type（这是"部分视频缩略图显示不出来"
    // 更根本的原因：旧版普通 PUT 上传从未存储过 content-type）。
    async regenerateThumbnail(file) {
      if (!this.canWrite) {
        this.showPermissionDialog('重新生成缩略图');
        return;
      }
      this.showContextMenu = false;

      const key = file.key || file;
      const fileName = key.split('/').pop();
      const guessedType = this.guessMimeFromExtension(fileName);

      if (!guessedType) {
        this.showCustomToast('该文件类型不支持生成缩略图', 'warning');
        return;
      }

      this.centerProgress = { visible: true, text: '正在修复文件类型信息...', fileName };

      try {
        // 第一步：只有存的 content-type 不对（或未知）时才先修复。这一步很关键——
        // 如果不先修复，下一步用网络地址加载视频时，浏览器会读到旧的/缺失的
        // content-type，根本不知道这是个视频，直接加载失败。类型已正确时跳过，
        // 省一次整文件重写（M9）。这一步只更新元数据，不需要重新上传文件本体。
        const storedType = file.httpMetadata?.contentType || null;
        if (storedType !== guessedType) {
          await axios.post(`/api/write/items/${apiPath(key)}?fixMetadata`, { contentType: guessedType });
        }

        this.centerProgress.text = guessedType.startsWith('video/')
          ? '正在读取视频帧（大文件可能需要几秒）...'
          : '正在读取图片...';

        // 直接基于网络地址生成缩略图：浏览器会按需分段（Range）请求，
        // 不用先把整个文件下载到内存里再解码，大文件也能较快出结果。
        // 加时间戳避免读到修复前的缓存响应。
        const signedUrl = this.rawUrl(key);
        const srcUrl = `${signedUrl}${signedUrl.includes('?') ? '&' : '?'}t=${Date.now()}`;
        const thumbnailBlob = await generateThumbnailFromUrl(srcUrl, guessedType);
        if (!thumbnailBlob) throw new Error('未能从文件中生成缩略图');

        this.centerProgress.text = '正在保存缩略图...';

        const digestHex = await blobDigest(thumbnailBlob);
        await axios.put(`/api/write/items/${apiPath('_$flaredrive$/thumbnails/' + digestHex + '.png')}`, thumbnailBlob);
        // 最后一次 fixMetadata 同时写回 contentType 和 thumbnail（端点支持两个字段）
        await axios.post(`/api/write/items/${apiPath(key)}?fixMetadata`, { contentType: guessedType, thumbnail: digestHex });

        await this.fetchFiles();
        this.showCustomToast(`"${fileName}" 的缩略图已重新生成`, 'success');
      } catch (error) {
        const status = error?.response?.status;
        if (error.isAuthError || status === 401 || status === 403) {
          this.showPermissionDialog('重新生成缩略图');
        } else {
          console.error('重新生成缩略图失败:', error);
          // 部分视频failure是浏览器本身就无法解码对应的编码格式（比如某些
          // HEVC/H.265），这种情况下前端没有办法强行解出缩略图，只能提示用户。
          this.showCustomToast('重新生成缩略图失败: ' + (error.message || '未知错误，可能是该视频编码格式当前浏览器不支持解码'), 'error');
        }
      } finally {
        this.centerProgress = { visible: false, text: '', fileName: '' };
      }
    },

    // F5：下载用单文件令牌（见 perFileUrl），不用目录令牌。
    // 由媒体预览的下载按钮触发（MediaPreview 发 request-download 事件）。
    async downloadWithPerFileToken(key, filename) {
      this.showContextMenu = false;
      try {
        const link = document.createElement('a');
        link.href = await this.perFileUrl(key);
        link.download = filename || key.split('/').pop();
        link.click();
        this.showCustomToast(`开始下载文件`, 'success');
      } catch (error) {
        this.showCustomToast('文件下载失败: ' + error.message, 'error');
      }
    },

    async singleDownload(key){
      // 关闭右键菜单
      this.showContextMenu = false;
      
      try {
        const link = document.createElement('a');
        link.href = await this.perFileUrl(key);
        link.download = key.split('/').pop();
        link.click();
        this.showCustomToast(`开始下载文件`, 'success');
      }catch (error) {
        this.showCustomToast('文件下载失败: ' + error.message, 'error');
      }
      
    },

    async renameFile(key) {
      // 检查写权限
      if (!this.canWrite) {
        this.showPermissionDialog('重命名文件');
        return;
      }

      // 关闭右键菜单
      this.showContextMenu = false;

      try {
        const currentName = key.split('/').pop();
        const newName = await this.showInputPrompt("重命名文件", "新名称:", currentName);
        if (!newName) return;
        // L9：新名称只能是单个文件名，不能包含路径分隔符
        if (newName.includes('/')) {
          this.showCustomToast('新名称不能包含 /，请只输入文件名', 'error');
          return;
        }
        if (newName === currentName) return;
        await this.copyPaste(key, `${this.cwd}${newName}`);
        // L9：复制成功但删除原文件失败时，两个文件都存在——必须明确告诉用户，
        // 而不是报一句含糊的"重命名失败"。
        try {
          await this.deleteFile(key);
        } catch (deleteError) {
          console.error('重命名：删除原文件失败:', deleteError);
          this.showCustomToast(`已复制到新名称 "${newName}"，但删除原文件失败，两个文件都存在`, 'warning');
          this.fetchFiles();
          return;
        }
        this.fetchFiles();
      } catch (error) {
        if (error === null) return; // 用户取消

        // 检查是否是权限错误
        if (error.isAuthError) {
          this.showPermissionDialog('重命名文件');
          return;
        }

        console.error('重命名失败:', error);
        this.showCustomToast('重命名失败: ' + (error.message || '未知错误'), 'error');
      }
    },

    // 获取用户有权限访问的目录列表
    // 新增：递归获取目录下所有文件和子目录
    // M6：按 marker 循环拉完；超过 20 页（40 万个对象）时抛出错误，调用方
    // （删除/移动文件夹）会中止并提示，不再删了标记就报"已删除"。
    async getAllItems(prefix) {
      const items = [];
      let marker = null;
      let pages = 0;

      do {
        const url = new URL(`/api/children/${apiPath(prefix)}`, window.location.origin);
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
        this.registerRawToken(data);

        // 添加文件
        items.push(...(data.value || []));

        // 处理子目录
        for (const folder of (data.folders || [])) {
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
        pages++;
        if (pages > 20) {
          throw new Error('目录过大（超过 40 万个对象），无法安全枚举，请分批操作');
        }
      } while (marker);

      return items;
    },

    uploadFiles(files) {
      if (this.cwd && !this.cwd.endsWith("/")) this.cwd += "/";

      // 撞名自动改名（与粘贴一致）：以当前文件列表 + 待传队列为准，
      // 既防同批重名，也防两批快速连续上传互相覆盖；列表过期时可能漏判（与粘贴同）。
      const usedNames = new Set();
      for (const f of this.files) usedNames.add(f.key.split('/').pop());
      for (const t of this.uploadQueue) {
        if (t.basedir === this.cwd) usedNames.add(t.targetName || t.file.name);
      }
      // F3：正在传的文件已不在队列里（已 shift 出来），把它也算进去，
      // 避免同名文件在它还没传完时入队、撞上同一个目标名。
      if (this.currentUpload && this.currentUpload.basedir === this.cwd) {
        usedNames.add(this.currentUpload.name);
      }
      const renamed = [];
      const uploadTasks = Array.from(files).map((file) => {
        const resolved = this.resolveAutoName(file.name, false, usedNames);
        if (resolved.renamed) renamed.push(`${file.name} → ${resolved.name}`);
        return {
          basedir: this.cwd,
          file,
          targetName: resolved.name,
        };
      });
      this.uploadQueue.push(...uploadTasks);
      if (renamed.length) {
        const shown = renamed.slice(0, 3).join('；');
        const more = renamed.length > 3 ? ` 等 ${renamed.length} 个` : '';
        this.showCustomToast(`以下文件因重名已自动改名：${shown}${more}`, 'warning');
      }
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
      this.searchDepthLimited = false;
      this.searchTruncated = false;

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

    // 在指定目录中搜索（M6：按 marker 拉完该目录的所有页；深度上限 5 层，
    // 触及时置 searchDepthLimited，调用方在界面上提示）
    async searchInDirectory(directory, searchTerm) {
      const results = [];

      try {
        // 准备请求头
        const headers = {};
        const savedCredentials = localStorage.getItem('authCredentials');
        if (savedCredentials) {
          headers['Authorization'] = `Basic ${savedCredentials}`;
        }

        let marker = null;
        let pages = 0;
        const seenFolders = new Set();
        do {
          const url = new URL(`/api/children/${apiPath(directory)}`, window.location.origin);
          if (marker) url.searchParams.set('marker', marker);
          const response = await fetch(url, { headers });
          const data = await response.json();
          this.registerRawToken(data);

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
              if (seenFolders.has(folder)) continue;
              seenFolders.add(folder);
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
              } else {
                this.searchDepthLimited = true;
              }
            }
          }

          marker = data.marker;
          pages++;
        } while (marker && pages < 5);
        if (marker) this.searchTruncated = true;
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
/* 剪切中的文件/文件夹：置灰，提示“待移动”；粘贴或取消后恢复 */
.cut-file {
  opacity: 0.45;
}

/* 底部进度条：文件名/状态文字 + 百分比在上，进度条在下，整体固定在视口底部；
   外层 left/right 双向定宽（不用 width:100%），div 画轨道和填充，不用原生 <progress>，
   左右贴边在各浏览器一致。 */
.bottom-progress-wrap {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9999;
  pointer-events: none;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.1);
}
.bottom-progress-info {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 12px;
  font-size: 13px;
  color: #555;
}
.bottom-progress-name {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.bottom-progress-pct {
  flex-shrink: 0;
}
.bottom-progress-bar {
  height: 4px;
  background: rgba(0, 0, 0, 0.08);
}
.bottom-progress-fill {
  height: 100%;
  background: #007bff;
  transition: width 0.2s ease;
}

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

/* 桌面端浮动粘贴按钮样式 */
.floating-paste-button.desktop {
  position: fixed;
  z-index: 1000;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 12px;
  padding: 12px 16px;
  cursor: move;
  box-shadow: 0 4px 20px rgba(102, 126, 234, 0.3);
  user-select: none;
  min-width: 200px;
  max-width: 220px;
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.floating-paste-button.desktop:hover {
  background: linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%);
  transform: translateY(-3px);
  box-shadow: 0 8px 25px rgba(102, 126, 234, 0.4);
}

.floating-paste-button.desktop:active {
  transform: translateY(-1px);
}

/* 半透明效果 */
.floating-paste-button.desktop.auto-hide {
  opacity: 0.6;
  transform: scale(0.95);
}

.floating-paste-button.desktop.auto-hide:hover {
  opacity: 1;
  transform: scale(1) translateY(-3px);
}

/* v20：粘贴进行中，浮动按钮置灰（点击由 pasteFile 的 isPasting 关卡拦住；
   桌面端用 .desktop.is-pasting 提高优先级，盖过 auto-hide 及其 :hover 的 opacity） */
.floating-paste-button.desktop.is-pasting,
.floating-paste-button.desktop.is-pasting:hover,
.floating-paste-button.mobile.is-pasting {
  opacity: 0.5;
}

/* 桌面端粘贴按钮内容 */
.floating-paste-button.desktop .paste-button-content {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 4px;
}

.floating-paste-button.desktop .paste-file-info {
  font-size: 11px;
  opacity: 0.9;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  background: rgba(255, 255, 255, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
}

/* v21：移动端浮动粘贴按钮——右侧 56px 小方块，只有图标，可触摸拖动；
   touch-action: none 让触摸拖动时页面不跟着滚动 */
.floating-paste-button.mobile {
  position: fixed;
  z-index: 1000;
  width: 56px;
  height: 56px;
  border-radius: 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  box-shadow: 0 4px 20px rgba(102, 126, 234, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  user-select: none;
  -webkit-user-select: none;
  touch-action: none;
  cursor: move;
}

.floating-paste-button.mobile:active {
  transform: scale(0.96);
}

.floating-paste-button.mobile .paste-button-content {
  margin: 0;
}

/* 移动端按钮角上的 ×（取消剪贴板） */
.floating-paste-button.mobile .paste-dismiss-btn {
  position: absolute;
  top: -8px;
  right: -8px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.6);
  font-size: 12px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  cursor: pointer;
}

.shortcut-hint {
  background: rgba(255, 255, 255, 0.2);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: normal;
  margin-left: auto;
}

/* 快捷键说明样式 */
.keyboard-shortcuts {
  margin: 20px auto 10px;
  padding: 10px;
  width: 60%;
  max-width: 95%;
  transition: width 0.3s ease;
}

.shortcuts-container {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  padding: 16px 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.shortcuts-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: #4a5568;
}

.shortcuts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 8px 16px;
  font-size: 13px;
}

.shortcut-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  color: #6b7280;
}

.shortcut-item kbd {
  background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%);
  border: 1px solid #d1d5db;
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 11px;
  font-weight: 600;
  color: #374151;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  min-width: 24px;
  text-align: center;
}

.touch-icon {
  font-size: 16px;
  min-width: 24px;
  text-align: center;
}

/* 桌面端中等屏幕优化 */
@media (max-width: 1280px) {
  .keyboard-shortcuts {
    width: 768px;
    padding: 10px;
  }
}

/* 移动端优化 */
@media (max-width: 768px) {
  .keyboard-shortcuts {
    margin: 15px 10px 5px;
    padding: 0;
    width: auto;
    max-width: none;
  }

  .shortcuts-container {
    padding: 12px 16px;
  }

  .shortcuts-grid {
    grid-template-columns: 1fr;
    gap: 6px;
  }

  .shortcut-item {
    font-size: 12px;
  }

  .shortcuts-title {
    font-size: 13px;
  }

  /* 在移动端隐藏桌面端快捷键，显示触摸提示 */
  .shortcut-item:not(.mobile-only) {
    display: none;
  }

  .mobile-only {
    display: flex !important;
  }
}

/* 桌面端隐藏移动端专用提示 */
@media (min-width: 769px) {
  .mobile-only {
    display: none;
  }
}



/* 自定义提示样式 */
.custom-toast {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 10000;
  min-width: 300px;
  max-width: 500px;
  padding: 16px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  animation: slideInRight 0.3s ease-out;
}

.custom-toast.success {
  background: #f0f9ff;
  border-left: 4px solid #10b981;
  color: #065f46;
}

.custom-toast.error {
  background: #fef2f2;
  border-left: 4px solid #ef4444;
  color: #991b1b;
}

.custom-toast.warning {
  background: #fffbeb;
  border-left: 4px solid #f59e0b;
  color: #92400e;
}

.toast-content {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
  font-weight: 500;
}

.toast-content svg {
  flex-shrink: 0;
}

@keyframes slideInRight {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

/* 屏幕中央的阻断式进度提示 */
.center-progress-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10001; /* 高于右上角的 toast (10000)，操作进行中时更明确地遮挡其余操作 */
}

.center-progress-box {
  background: #fff;
  border-radius: 12px;
  padding: 28px 36px;
  min-width: 220px;
  max-width: 80vw;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  text-align: center;
}

.center-progress-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #e5e7eb;
  border-top-color: #10b981;
  border-radius: 50%;
  animation: center-progress-spin 0.8s linear infinite;
}

@keyframes center-progress-spin {
  to {
    transform: rotate(360deg);
  }
}

.center-progress-text {
  font-size: 15px;
  color: #1f2937;
  font-weight: 500;
}

.center-progress-filename {
  font-size: 13px;
  color: #6b7280;
  word-break: break-all;
}

/* 移动端提示样式 */
@media (max-width: 768px) {
  .custom-toast {
    left: 20px;
    right: 20px;
    min-width: auto;
    max-width: none;
  }
}

/* 文件操作工具栏样式 */
.file-toolbar {
  flex-wrap: wrap;
  gap: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  margin-bottom: 12px;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.file-toolbar .toolbar-btn.primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
}

.file-toolbar .toolbar-btn.primary:hover {
  background: linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%);
  transform: translateY(-1px);
}

/* 多选功能样式 */
.multi-select-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  margin-bottom: 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 8px;
  color: white;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
}

.toolbar-left {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  min-width: 0;
}

.toolbar-right {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
}

.toolbar-btn > svg {
  flex-shrink: 0;
}

.toolbar-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 6px;
  color: white;
  font-size: 13px;
  white-space: nowrap;
  max-width: 100%;
  cursor: pointer;
  transition: all 0.2s ease;
}

.toolbar-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: translateY(-1px);
}

.toolbar-btn.danger {
  background: rgba(239, 68, 68, 0.8);
  border-color: rgba(239, 68, 68, 0.9);
}

.toolbar-btn.danger:hover {
  background: rgba(239, 68, 68, 0.9);
}

.selected-count {
  font-size: 14px;
  font-weight: 500;
  opacity: 0.9;
}

/* 文件选择样式 */
.file-checkbox {
  position: absolute;
  left: 8px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 10;
  padding: 4px;
  border-radius: 4px;
  transition: background-color 0.2s ease;
}

.file-checkbox:hover {
  background-color: rgba(102, 126, 234, 0.1);
}

.file-checkbox input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: #667eea;
  margin: 0;
}

.file-item.selected {
  background: rgba(102, 126, 234, 0.1);
  border-left: 4px solid #667eea;
}

.file-item {
  position: relative;
  transition: all 0.2s ease;
}

/* 多选模式下文件项的左边距调整 */
.file-item {
  padding-left: 8px;
  transition: padding-left 0.2s ease;
}

/* 当存在复选框时增加左边距 */
.file-item:has(.file-checkbox) {
  padding-left: 40px;
}

/* 兼容不支持:has()的浏览器 */
@supports not (selector(:has(.file-checkbox))) {
  /* 只给紧跟在复选框后的图标加左边距(旧版 Android WebView 不支持 :has())。
     之前用 ~ 会给所有后续兄弟元素都加 32px，把文字区域整体撑出边框。 */
  .file-item .file-checkbox + * {
    margin-left: 32px;
  }
}

/* 移动端多选工具栏优化 */
@media (max-width: 768px) {
  .multi-select-toolbar {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }

  .toolbar-left,
  .toolbar-right {
    justify-content: center;
    flex-wrap: wrap;
  }

  .toolbar-btn {
    flex: 1;
    justify-content: center;
    min-width: 80px;
  }

  .selected-count {
    text-align: center;
    width: 100%;
  }
}
</style>
