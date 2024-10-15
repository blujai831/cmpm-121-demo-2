import "./style.css";

const APP_NAME = "Sticker Sketchpad";
const LEFT_CLICK = 0;
const LEFT_CLICK_FLAG = 1;
const app = document.querySelector<HTMLDivElement>("#app")!;

interface Point {x: number, y: number}

let displayList: Point[][] = [];

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
    elem.id = 'user-drawing-area';
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

function drawLine(from: Point, to: Point): void {
    canvasContext.beginPath();
    canvasContext.moveTo(from.x, from.y);
    canvasContext.lineTo(to.x, to.y);
    canvasContext.closePath();
    canvasContext.stroke();
}

canvas.addEventListener('mousedown', ev => {
    if (ev.button == LEFT_CLICK) {
        displayList.push([]);
    }
});

canvas.addEventListener('mousemove', ev => {
    const posn: Point = {
        x: ev.clientX - canvas.offsetLeft,
        y: ev.clientY - canvas.offsetTop
    };
    if ((ev.buttons & LEFT_CLICK_FLAG) == LEFT_CLICK_FLAG) {
        if (displayList.length > 0) {
            const pointList = displayList[displayList.length - 1];
            pointList.push(posn);
            if (pointList.length > 1) {
                drawLine(pointList[pointList.length - 2], posn);
            }
        }
    }
});

makeElement('button', elem => {
    elem.innerHTML = "Clear";
    elem.onclick = _ => {
        canvasContext.clearRect(0, 0, canvas.width, canvas.height);
    }
});