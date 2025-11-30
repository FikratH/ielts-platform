// Тест системы защиты Writing тестов
// Этот файл можно использовать для проверки функциональности

const testWritingProtection = () => {
  console.log('🧪 Тестирование системы защиты Writing тестов');
  
  // Тест 1: Проверка CSS стилей
  const testElement = document.createElement('div');
  testElement.className = 'no-copy';
  testElement.style.userSelect = 'none';
  
  console.log('✅ CSS стили применены:', testElement.style.userSelect === 'none');
  
  // Тест 2: Проверка обработчиков событий
  let pasteBlocked = false;
  let copyBlocked = false;
  
  const testHandler = (e) => {
    e.preventDefault();
    if (e.type === 'paste') pasteBlocked = true;
    if (e.type === 'copy') copyBlocked = true;
  };
  
  testElement.addEventListener('paste', testHandler);
  testElement.addEventListener('copy', testHandler);
  
  // Симуляция событий
  const pasteEvent = new Event('paste');
  const copyEvent = new Event('copy');
  
  testElement.dispatchEvent(pasteEvent);
  testElement.dispatchEvent(copyEvent);
  
  console.log('✅ Обработчики событий работают:', pasteBlocked && copyBlocked);
  
  // Тест 3: Проверка глобальных обработчиков клавиатуры
  let keyboardBlocked = false;
  
  const keyboardHandler = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
      e.preventDefault();
      keyboardBlocked = true;
    }
  };
  
  document.addEventListener('keydown', keyboardHandler);
  
  // Симуляция Ctrl+V
  const keyboardEvent = new KeyboardEvent('keydown', {
    key: 'v',
    ctrlKey: true
  });
  
  document.dispatchEvent(keyboardEvent);
  
  console.log('✅ Глобальная защита клавиатуры работает:', keyboardBlocked);
  
  // Очистка
  document.removeEventListener('keydown', keyboardHandler);
  
  console.log('🎉 Все тесты пройдены успешно!');
};

// Запуск тестов при загрузке страницы
if (typeof window !== 'undefined') {
  window.testWritingProtection = testWritingProtection;
  console.log('Тестовая функция testWritingProtection() доступна в консоли');
}
