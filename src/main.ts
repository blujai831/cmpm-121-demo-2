import "./style.css";

const APP_NAME = "Sticker Sketchpad";
const LEFT_CLICK = 0;
const LEFT_CLICK_FLAG = 1;
const app = document.querySelector<HTMLDivElement>("#app")!;

interface Point {x: number, y: number}

const displayList: Point[][] = [];
const undoStack = displayList;
const redoStack: Point[][] = [];

document.title = APP_NAME;

function makeElement<Tag extends keyof HTMLElementTagNameMap>(
    parent: Node, what: Tag, attrs?: Partial<HTMLElementTagNameMap[Tag]>,
    how?: (elem: HTMLElementTagNameMap[Tag]) => void
): HTMLElementTagNameMap[Tag] {
    const elem = document.createElement(what);
    if (attrs !== undefined) Object.assign(elem, attrs);
    how?.call(elem, elem);
    parent.appendChild(elem);
    return elem;
}

makeElement(app, 'h1', {}, elem => elem.innerHTML = APP_NAME);
const canvas = makeElement(app, 'canvas', {
    id: 'user-drawing-area', width: 256, height: 256
});

const canvasContext: CanvasRenderingContext2D = (() => {
    const result = canvas.getContext('2d');
    if (result === null) throw Error("No 2D rendering support");
    else return result;
})();
canvasContext.lineWidth = 4;
canvasContext.strokeStyle = 'black';

function drawingUndo(): boolean {
    if (undoStack.length > 0) {
        redoStack.push(undoStack.pop()!);
        canvas.dispatchEvent(new Event('drawing-changed'));
        return true;
    } else return false;
}

function drawingRedo(): boolean {
    if (redoStack.length > 0) {
        undoStack.push(redoStack.pop()!)
        canvas.dispatchEvent(new Event('drawing-changed'));
        return true;
    } else return false;
}

function drawingClear(): void {
    redoStack.length = 0;
    displayList.length = 0;
    canvas.dispatchEvent(new Event('drawing-changed'));
}

function drawingBeginUndoStep(): void {
    redoStack.length = 0;
    undoStack.push([]);
}

function drawLine(from: Point, to: Point): void {
    canvasContext.beginPath();
    canvasContext.moveTo(from.x, from.y);
    canvasContext.lineTo(to.x, to.y);
    canvasContext.closePath();
    canvasContext.stroke();
}

makeElement(app, 'button', {innerHTML: "Undo", onclick: drawingUndo});
makeElement(app, 'button', {innerHTML: "Redo", onclick: drawingRedo});
makeElement(app, 'button', {innerHTML: "Clear", onclick: drawingClear});

canvas.addEventListener('mousedown', ev => {
    if (ev.button == LEFT_CLICK) {
        drawingBeginUndoStep();
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
            canvas.dispatchEvent(new Event('drawing-changed'));
        }
    }
});

canvas.addEventListener('drawing-changed', _ => {
    canvasContext.clearRect(0, 0, canvas.width, canvas.height);
    for (const pointList of displayList) {
        let lastPosn: Point | null = null;
        for (const posn of pointList) {
            if (lastPosn !== null) {
                drawLine(lastPosn, posn);
            }
            lastPosn = posn;
        }
    }
});