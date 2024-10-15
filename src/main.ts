import "./style.css";

const APP_NAME = "Sticker Sketchpad";
const LEFT_CLICK = 1; // Why no standard library enum?
const app = document.querySelector<HTMLDivElement>("#app")!;

document.title = APP_NAME;

function makeElement<Tag extends keyof HTMLElementTagNameMap>(
    what: Tag, how?: (elem: HTMLElementTagNameMap[Tag]) => void
): HTMLElementTagNameMap[Tag] {
    const elem = document.createElement(what);
    how?.call(elem, elem);
    app.appendChild(elem);
    return elem;
}

makeElement('h1', elem => elem.innerHTML = APP_NAME);
const canvas = makeElement('canvas', elem => {
    elem.width = 256;
    elem.height = 256;
});

const canvasContext: CanvasRenderingContext2D = (() => {
    const result = canvas.getContext('2d');
    if (result === null) throw Error("No 2D rendering support");
    else return result;
})();
canvasContext.lineWidth = 4;
canvasContext.strokeStyle = 'black';

canvas.addEventListener('mousemove', ev => {
    if ((ev.buttons & LEFT_CLICK) == LEFT_CLICK) {
        canvasContext.beginPath();
        canvasContext.moveTo(
            ev.clientX - ev.movementX - canvas.offsetLeft,
            ev.clientY - ev.movementY - canvas.offsetTop
        );
        canvasContext.lineTo(
            ev.clientX - canvas.offsetLeft,
            ev.clientY - canvas.offsetTop
        );
        canvasContext.closePath();
        canvasContext.stroke();
    }
});

makeElement('button', elem => {
    elem.innerHTML = "Clear";
    elem.onclick = _ => {
        canvasContext.clearRect(0, 0, canvas.width, canvas.height);
    }
});