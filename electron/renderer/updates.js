// electron/renderer/updates.js
import { $ } from './dom.js';

// New version banner: Windows/Linux AppImage download it in the background
// and install on restart; the Mac build links to the release page.
function showUpdate(status) {
  if (!status) return;
  const action = $('update-action');
  action.hidden = status.state === 'downloading';
  if (status.state === 'available') {
    $('update-text').textContent = `🆕 새 버전 v${status.version}이 나왔다!`;
    action.textContent = '다운로드 페이지';
    action.onclick = () => window.promptBattle.openReleasePage();
  } else if (status.state === 'downloading') {
    $('update-text').textContent = `⬇️ 새 버전 v${status.version} 받는 중...`;
  } else {
    $('update-text').textContent = `✅ 새 버전 v${status.version} 준비 완료`;
    action.textContent = '재시작해서 설치';
    action.onclick = () => window.promptBattle.installUpdate();
  }
  $('update-banner').hidden = false;
}
$('update-dismiss').addEventListener('click', () => ($('update-banner').hidden = true));
window.promptBattle.onUpdateStatus(showUpdate);
window.promptBattle.checkUpdate().then(showUpdate);
