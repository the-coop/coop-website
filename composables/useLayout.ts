import { ref } from 'vue';

export const layoutName = ref('default');

export const useLayout = () => {
  const setLayout = (name: string) => {
    layoutName.value = name
  }

  return {
    layoutName,
    setLayout
  };
};
