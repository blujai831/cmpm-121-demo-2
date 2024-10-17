import "./style.css";

// Readonly constants

const APP_NAME = "Sticker Sketchpad" as const;
const LEFT_CLICK = 0 as const;
const LEFT_CLICK_FLAG = 1 as const;

// Interfaces

interface Point {x: number, y: number}

interface DrawCommand {
    display(ctx: CanvasRenderingContext2D): void;
}

// Dynamic constants

const app = document.querySelector<HTMLDivElement>("#app")!;
const displayList: DrawCommand[] = [];
const undoStack = displayList;
const redoStack: DrawCommand[] = [];

// UI output

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

// App implementation

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

function drawingBeginUndoStep(command: DrawCommand): void {
    redoStack.length = 0;
    undoStack.push(command);
}

class DrawStrokeCommand implements DrawCommand {
    private points: Point[];
    public constructor(start: Point) {
        this.points = [start];
    }
    public drag(where: Point): void {
        this.points.push(where);
    }
    public display(ctx: CanvasRenderingContext2D): void {
        let lastPosn: Point | null = null;
        for (const posn of this.points) {
            if (lastPosn !== null) {
                ctx.beginPath();
                ctx.moveTo(lastPosn.x, lastPosn.y);
                ctx.lineTo(posn.x, posn.y);
                ctx.closePath();
                ctx.stroke();
            }
            lastPosn = posn;
        }
    }
}

// UI input

makeElement(app, 'button', {innerHTML: "Undo", onclick: drawingUndo});
makeElement(app, 'button', {innerHTML: "Redo", onclick: drawingRedo});
makeElement(app, 'button', {innerHTML: "Clear", onclick: drawingClear});

canvas.addEventListener('mousedown', ev => {
    if (ev.button == LEFT_CLICK) {
        drawingBeginUndoStep(new DrawStrokeCommand({
            x: ev.clientX - canvas.offsetLeft,
            y: ev.clientY - canvas.offsetTop
        }));
        canvas.dispatchEvent(new Event('drawing-changed'));
    }
});

canvas.addEventListener('mousemove', ev => {
    const posn: Point = {
        x: ev.clientX - canvas.offsetLeft,
        y: ev.clientY - canvas.offsetTop
    };
    if ((ev.buttons & LEFT_CLICK_FLAG) == LEFT_CLICK_FLAG) {
        if (displayList.length > 0) {
            const command = displayList[displayList.length - 1];
            if (command instanceof DrawStrokeCommand) {
                command.drag(posn);
                canvas.dispatchEvent(new Event('drawing-changed'));
            }
        }
    }
});

canvas.addEventListener('drawing-changed', _ => {
    canvasContext.clearRect(0, 0, canvas.width, canvas.height);
    for (const command of displayList) command.display(canvasContext);
});
