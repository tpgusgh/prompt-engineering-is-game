// electron/renderer/updates.js
import { $ } from './dom.js';

// New version banner: Windows/Linux AppImage download it in the background
// and install on restart; the Mac build links to the release page.
function showUpdate(status) {
  if (!status || status.state === 'latest') return;
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

// The "업데이트 확인" button: checks again now and always answers.
$('update-check-btn').addEventListener('click', async () => {
  const btn = $('update-check-btn');
  btn.disabled = true;
  btn.textContent = '🔄 확인 중...';
  const status = await window.promptBattle.checkUpdate(true);
  btn.disabled = false;
  btn.textContent = '🔄 업데이트';
  if (!status) {
    $('update-text').textContent = '⚠️ 업데이트를 확인하지 못했다 (인터넷 연결을 확인해줘)';
    $('update-action').hidden = true;
    $('update-banner').hidden = false;
  } else if (status.state === 'latest') {
    $('update-text').textContent = `✅ 최신 버전이다 (v${status.version})`;
    $('update-action').hidden = true;
    $('update-banner').hidden = false;
  } else showUpdate(status);
});
