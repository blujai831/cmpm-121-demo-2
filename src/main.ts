import "./style.css";

// Readonly constants

const APP_NAME = "Sticker Sketchpad" as const;
const LEFT_CLICK = 0 as const;
const LEFT_CLICK_FLAG = 1 as const;
const RELIEVED_EMOJI = "\u{1F60C}" as const;
const EXPRESSIONLESS_EMOJI = "\u{1F611}" as const;
const PENSIVE_EMOJI = "\u{1F614}" as const;

// Interfaces

interface Point {x: number, y: number}

interface DrawCommand {
    get posn(): Point;
    move(posn: Point): void;
    draw(ctx: CanvasRenderingContext2D): void;
}

interface DrawingTool {
    makeDrawCommand(): DrawCommand;
    makeCursorDrawCommand(): DrawCommand;
}

// Dynamic globals

const app = document.querySelector<HTMLDivElement>("#app")!;
const displayList: DrawCommand[] = [];
const undoStack = displayList;
const redoStack: DrawCommand[] = [];
let drawingTool: string;
let cursorDrawCommand: DrawCommand | null;

const drawingTools: Record<string, DrawingTool> = {
    "Thin Marker": makeMarkerDrawingTool({lineWidth: 2}),
    "Thick Marker": makeMarkerDrawingTool({lineWidth: 6}),
    [RELIEVED_EMOJI]: makeStickerDrawingTool({text: RELIEVED_EMOJI}),
    [EXPRESSIONLESS_EMOJI]: makeStickerDrawingTool({text: EXPRESSIONLESS_EMOJI}),
    [PENSIVE_EMOJI]: makeStickerDrawingTool({text: PENSIVE_EMOJI})
};

// Utility functions

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

function forEachAdjacentPair<T>(
    ts: T[], doWhat: (t1: T, t2: T) => void
): void {
    let lastT: T | null = null;
    for (const t of ts) {
        if (lastT !== null) doWhat(lastT, t);
        lastT = t;
    }
}

// UI general layout

document.title = APP_NAME;

makeElement(app, 'h1', {}, elem => elem.innerHTML = APP_NAME);
const canvas = makeElement(app, 'canvas', {
    id: 'user-drawing-area', width: 256, height: 256
});
const toolButtonsDiv = makeElement(app, 'div', {id: 'tool-buttons'});
const actionButtonsDiv = makeElement(app, 'div', {id: 'action-buttons'});

const canvasContext: CanvasRenderingContext2D = (() => {
    const result = canvas.getContext('2d');
    if (result === null) throw Error("No 2D rendering support");
    else return result;
})();

// Tool-agnostic canvas operations

function drawingUndo(): boolean {
    if (undoStack.length > 0) {
        redoStack.push(undoStack.pop()!);
        return true;
    } else return false;
}

function drawingRedo(): boolean {
    if (redoStack.length > 0) {
        undoStack.push(redoStack.pop()!)
        return true;
    } else return false;
}

function drawingClear(): void {
    redoStack.length = 0;
    displayList.length = 0;
}

function drawingBeginUndoStep(): void {
    redoStack.length = 0;
    undoStack.push(drawingTools[drawingTool].makeDrawCommand());
}

function drawingGetUndoStep(): DrawCommand | null {
    if (undoStack.length > 0) return undoStack[undoStack.length - 1];
    else return null;
}

function drawingSetTool(which: string): void {
    drawingTool = which;
    drawingShowCursor();
}

function drawingUpdate(
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D
): void {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const command of displayList) command.draw(ctx);
    if (cursorDrawCommand !== null) cursorDrawCommand.draw(ctx);
}

function drawingShowCursor(): void {
    cursorDrawCommand = drawingTools[drawingTool].makeCursorDrawCommand();
}

function drawingHideCursor(): void {
    cursorDrawCommand = null;
}

function drawPath(
    ctx: CanvasRenderingContext2D,
    how: (ctx: CanvasRenderingContext2D) => void
): void {
    ctx.beginPath();
    how(ctx);
    ctx.closePath();
    ctx.stroke();
}

function drawLine(ctx: CanvasRenderingContext2D, p1: Point, p2: Point): void {
    drawPath(ctx, ctx => {ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);});
}

function drawCircle(
    ctx: CanvasRenderingContext2D, posn: Point, radius: number
): void {
    drawPath(ctx, ctx =>
        ctx.ellipse(posn.x, posn.y, radius, radius, 0, 0, 2*Math.PI));
}

// Tool implementations

function makeMarkerDrawCommand(options: {
    lineWidth: number
}) {return {
    points: [] as Point[],
    get posn(): Point {
        if (this.points.length > 0) return this.points[this.points.length - 1];
        else return {x: NaN, y: NaN};
    },
    move(posn: Point) {this.points.push(posn);},
    draw(ctx: CanvasRenderingContext2D) {
        ctx.lineWidth = options.lineWidth;
        forEachAdjacentPair(this.points, (p1, p2) => drawLine(ctx, p1, p2));
    }
};}

function makeCircleCursorDrawCommand(options: {
    radius: number
}) {return {
    posn: {x: 0, y: 0},
    move(posn: Point) {this.posn = posn;},
    draw(ctx: CanvasRenderingContext2D) {
        ctx.lineWidth = 1;
        drawCircle(ctx, this.posn, options.radius);
    }
};}

function makeStickerDrawCommand(options: {
    text: string
}) {return {
    posn: {...(cursorDrawCommand?.posn || {x: 0, y: 0})},
    move(posn: Point) {this.posn = posn;},
    draw(ctx: CanvasRenderingContext2D) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(options.text, this.posn.x, this.posn.y);
    }
};}

function makeMarkerDrawingTool(options: {
    lineWidth: number
}): DrawingTool {return {
    makeDrawCommand(): DrawCommand {
        return makeMarkerDrawCommand({lineWidth: options.lineWidth});
    },
    makeCursorDrawCommand(): DrawCommand {
        return makeCircleCursorDrawCommand({radius: options.lineWidth/2});
    }
};}

function makeStickerDrawingTool(options: {
    text: string
}): DrawingTool {return {
    makeDrawCommand(): DrawCommand {
        return makeStickerDrawCommand({text: options.text});
    },
    makeCursorDrawCommand(): DrawCommand {
        return this.makeDrawCommand();
    }
};}

// UI input handling

for (const toolName of Object.keys(drawingTools)) {
    makeElement(toolButtonsDiv, 'button', {
        innerHTML: toolName,
        onclick: _ => {
            if (drawingTool != toolName) {
                drawingSetTool(toolName);
                toolButtonsDiv.dispatchEvent(new Event('tool-changed'));
                canvas.dispatchEvent(new Event('tool-moved'));
            }
        }
    }, elem => toolButtonsDiv.addEventListener('tool-changed', _ => {
        elem.disabled = (drawingTool == toolName);
    }, true));
}

for (const action of [
    {name: "Undo", doWhat: drawingUndo},
    {name: "Redo", doWhat: drawingRedo},
    {name: "Clear", doWhat: drawingClear}
]) {
    makeElement(actionButtonsDiv, 'button', {
        innerHTML: action.name,
        onclick: _ => {
            action.doWhat();
            canvas.dispatchEvent(new Event('drawing-changed'));
        }
    });
}

canvas.addEventListener('mousedown', ev => {
    if (ev.button == LEFT_CLICK) {
        drawingBeginUndoStep();
        canvas.dispatchEvent(new Event('drawing-changed'));
        drawingHideCursor();
        canvas.dispatchEvent(new Event('tool-moved'));
    }
});

canvas.addEventListener('mousemove', ev => {
    const posn: Point = {
        x: ev.clientX - canvas.offsetLeft,
        y: ev.clientY - canvas.offsetTop
    };
    if (
        (ev.buttons & LEFT_CLICK_FLAG) == LEFT_CLICK_FLAG &&
        displayList.length > 0
    ) {
        drawingHideCursor();
        const command = drawingGetUndoStep();
        if (command !== null) {
            command.move(posn);
            canvas.dispatchEvent(new Event('drawing-changed'));
        }
    } else {
        drawingShowCursor();
        cursorDrawCommand?.move(posn);
    }
    canvas.dispatchEvent(new Event('tool-moved'));
});

canvas.addEventListener('drawing-changed', _ =>
    drawingUpdate(canvas, canvasContext));
canvas.addEventListener('tool-moved', _ =>
    drawingUpdate(canvas, canvasContext));

// Runtime initialization

drawingSetTool("Thin Marker");
toolButtonsDiv.dispatchEvent(new Event('tool-changed'));
canvasContext.strokeStyle = 'black';
canvasContext.font = "48px sans-serif";