const CLOSE_THRESHOLD = 80;
const RELEASE_TRANSITION = 'transform .3s cubic-bezier(0.4, 0, 0.2, 1)';
const RELEASE_DURATION = 300;

// グリップをドラッグしてシートを閉じる（一定距離を超えたら下までスライドさせてから filter-open を解除、それ以外は元の位置に戻る）
export function initSheetDrag(grip, panel, body) {
    if (!grip || !panel || !body) return;

    let dragging = false;
    let startY = 0;
    let deltaY = 0;

    const onPointerMove = (event) => {
        if (!dragging) return;
        deltaY = Math.max(0, event.clientY - startY);
        panel.style.transform = `translateY(${deltaY}px)`;
    };

    const onPointerUp = () => {
        if (!dragging) return;
        dragging = false;
        document.removeEventListener('pointermove', onPointerMove);
        document.removeEventListener('pointerup', onPointerUp);
        document.removeEventListener('pointercancel', onPointerUp);

        panel.style.transition = RELEASE_TRANSITION;

        if (deltaY > CLOSE_THRESHOLD) {
            panel.style.transform = `translateY(${panel.offsetHeight}px)`;
            setTimeout(() => {
                body.classList.remove('filter-open');
                panel.style.transition = '';
                panel.style.transform = '';
            }, RELEASE_DURATION);
        } else {
            panel.style.transform = '';
            setTimeout(() => {
                panel.style.transition = '';
            }, RELEASE_DURATION);
        }

        deltaY = 0;
    };

    grip.addEventListener('pointerdown', (event) => {
        dragging = true;
        startY = event.clientY;
        deltaY = 0;
        panel.style.transition = 'none';
        document.addEventListener('pointermove', onPointerMove);
        document.addEventListener('pointerup', onPointerUp);
        document.addEventListener('pointercancel', onPointerUp);
    });
}
