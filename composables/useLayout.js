import { ref } from 'vue';

export const layoutName = ref('default');

export const useLayout = () => {
  const setLayout = (name) => {
    layoutName.value = name
  }

  return {
    layoutName,
    setLayout
  };
};
