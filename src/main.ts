import "./style.css";

// Readonly constants

const APP_NAME = "Sticker Sketchpad" as const;
const LEFT_CLICK = 0 as const;
const LEFT_CLICK_FLAG = 1 as const;

const DRAWING_TOOLS = {
    "Thin Marker": (posn: Point) =>
        new DrawStrokeCommand(posn, 2),
    "Thick Marker": (posn: Point) =>
        new DrawStrokeCommand(posn, 6)
} as const;

// Interfaces

interface Point {x: number, y: number}

interface DrawCommand {
    display(ctx: CanvasRenderingContext2D): void;
}

// Dynamic globals

const app = document.querySelector<HTMLDivElement>("#app")!;
const displayList: DrawCommand[] = [];
const undoStack = displayList;
const redoStack: DrawCommand[] = [];
let drawingTool: keyof typeof DRAWING_TOOLS;

// Utility functions

/* Technique learned from:
https://www.totaltypescript.com/iterate-over-object-keys-in-typescript */
function keysAsUnion<T extends object>(obj: T): (keyof T)[] {
    const result: (keyof T)[] = [];
    for (const key in obj) result.push(key);
    return result;
}

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

// UI output

document.title = APP_NAME;

makeElement(app, 'h1', {}, elem => elem.innerHTML = APP_NAME);
const canvas = makeElement(app, 'canvas', {
    id: 'user-drawing-area', width: 256, height: 256
});
const toolButtonsDiv = makeElement(app, 'div', {id: 'tool-buttons'});

// App implementation

const canvasContext: CanvasRenderingContext2D = (() => {
    const result = canvas.getContext('2d');
    if (result === null) throw Error("No 2D rendering support");
    else return result;
})();

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

function drawingBeginUndoStep(posn: Point): void {
    redoStack.length = 0;
    undoStack.push(DRAWING_TOOLS[drawingTool](posn));
}

function drawingSetTool(which: keyof typeof DRAWING_TOOLS): void {
    drawingTool = which;
    toolButtonsDiv.dispatchEvent(new Event('tool-changed'));
}

class DrawStrokeCommand implements DrawCommand {
    private points: Point[];
    private lineWidth: number;
    public constructor(start: Point, lineWidth: number) {
        this.points = [start];
        this.lineWidth = lineWidth;
    }
    public drag(where: Point): void {
        this.points.push(where);
    }
    public display(ctx: CanvasRenderingContext2D): void {
        let lastPosn: Point | null = null;
        for (const posn of this.points) {
            if (lastPosn !== null) {
                ctx.lineWidth = this.lineWidth;
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

for (const toolName of keysAsUnion(DRAWING_TOOLS)) {
    makeElement(toolButtonsDiv, 'button', {
        innerHTML: toolName,
        onclick: _ => drawingSetTool(toolName)
    }, elem => toolButtonsDiv.addEventListener('tool-changed', _ => {
        elem.disabled = (drawingTool == toolName);
    }, true));
}

makeElement(app, 'button', {innerHTML: "Undo", onclick: drawingUndo});
makeElement(app, 'button', {innerHTML: "Redo", onclick: drawingRedo});
makeElement(app, 'button', {innerHTML: "Clear", onclick: drawingClear});

canvas.addEventListener('mousedown', ev => {
    if (ev.button == LEFT_CLICK) {
        drawingBeginUndoStep({
            x: ev.clientX - canvas.offsetLeft,
            y: ev.clientY - canvas.offsetTop
        });
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

// Runtime initialization

drawingSetTool("Thin Marker");
canvasContext.strokeStyle = 'black';
