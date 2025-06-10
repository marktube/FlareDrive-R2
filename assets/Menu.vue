<script setup>
defineProps({
  modelValue: Boolean,
  items: {
    type: Array,
    required: true,
  },
});

const emit = defineEmits(["update:modelValue", "click"]);
</script>

<template>
  <div class="menu">
    <Transition name="fade">
      <div
        v-show="modelValue"
        class="menu-modal"
        @click="emit('update:modelValue', false)"
      ></div>
    </Transition>
    <div v-show="modelValue" class="menu-content">
      <ul>
        <li
          v-for="(item, index) in items"
          :key="index"
          @click="
            emit('update:modelValue', false);
            emit('click', item.text);
          "
        >
          <span v-text="item.text"></span>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.menu-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.2);
  z-index: 1;
}

.menu-content {
  top: 16px;
  position: absolute;
  background-color: white;
  z-index: 2;
  border-radius: 6px;
  right: 0;
  min-width: 168px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  border: 1px solid rgba(0, 0, 0, 0.1);
}

.menu-content li {
  padding: 10px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.menu-content li:hover {
  background-color: rgba(0, 0, 0, 0.1);
}

/* 移动端菜单优化 */
@media (max-width: 768px) {
  .menu-content {
    right: -10px; /* 稍微向左偏移，避免贴边 */
    min-width: 180px;
    font-size: 16px; /* 增大字体，便于触摸 */
  }

  .menu-content li {
    padding: 14px 16px; /* 增大触摸区域 */
  }
}

@media (max-width: 480px) {
  .menu-content {
    right: -5px;
    min-width: 160px;
  }

  .menu-content li {
    padding: 12px 14px;
    font-size: 15px;
  }
}
</style>
