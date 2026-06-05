const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'node_modules', 'expo-modules-core', 'android', 'ExpoModulesCorePlugin.gradle');

if (fs.existsSync(file)) {
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes('from components.release')) {
    content = content.replace('from components.release', 'from components.named("release").get()');
    fs.writeFileSync(file, content);
    console.log('✅ Patched ExpoModulesCorePlugin.gradle (fixed components.release for AGP 8.x)');
  } else {
    console.log('ℹ️  ExpoModulesCorePlugin.gradle already patched or not found.');
  }
} else {
  console.log('⚠️  expo-modules-core Gradle file not found, skipping patch.');
}
