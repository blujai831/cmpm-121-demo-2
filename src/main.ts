import "./style.css";

// Constants
// app
const APP_NAME = "Sticker Sketchpad";
const LEFT_CLICK = 0;
const LEFT_CLICK_FLAG = 1;
const SKETCHPAD_RESOLUTION = {width: 256, height: 256} as const;
const EXPORT_DOWNLOAD_RESOLUTION = {width: 1024, height: 1024} as const;

// emojis
const RELIEVED_EMOJI = "\u{1F60C}";
const EXPRESSIONLESS_EMOJI = "\u{1F611}";
const PENSIVE_EMOJI = "\u{1F614}";

// export
const EXPORT_DOWNLOAD_FILENAME = "sketch.png";
const STICKER_TEXT_STYLE = "192px sans-serif";

// Interfaces

type CanvasMaybeOffscreen = HTMLCanvasElement | OffscreenCanvas;

type CanvasRenderingContext2DMaybeOffscreen =
    CanvasRenderingContext2D |
    OffscreenCanvasRenderingContext2D;

interface Point {
    x: number;
    y: number;
}

interface DrawCommand {
    get posn(): Point;
    move(posn: Point): void;
    draw(ctx: CanvasRenderingContext2DMaybeOffscreen): void;
}

interface DrawingTool {
    makeDrawCommand(): DrawCommand;
    makeCursorDrawCommand(): DrawCommand;
}

interface MarkerOptions {
    lineWidth: number;
}

interface StickerOptions {
    text: string;
}

interface CircleOptions {
    radius: number;
}

// Dynamic globals

// Main HTML element references
const app = document.querySelector<HTMLDivElement>("#app")!;
const displayList: DrawCommand[] = [];
let drawingTool: string;
let cursorDrawCommand: DrawCommand | null;

// Storage for undo and redo actions
const undoStack = displayList;
const redoStack: DrawCommand[] = [];

// Drawing tools registration
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

function getContext2D(
    canvas: CanvasMaybeOffscreen
): CanvasRenderingContext2DMaybeOffscreen {
    const result = canvas.getContext('2d');
    if (result === null) throw Error("No 2D rendering support");
    else return result;
}

function download(url: string, fname: string): void {
    const link = document.createElement('a');
    link.style.display = 'none';
    link.href = url;
    link.download = fname;
    app.appendChild(link);
    link.click();
    app.removeChild(link);  
}

// Layout Setup

document.title = APP_NAME;

// Main UI components creation
makeElement(app, 'h1', {}, elem => elem.innerHTML = APP_NAME);

// Canvas setup
const canvas = makeElement(app, 'canvas', {
    id: 'user-drawing-area', ...SKETCHPAD_RESOLUTION
});
const canvasContext = getContext2D(canvas);

// Toolbar setup
const toolButtonsDiv = makeElement(app, 'div', {id: 'tool-buttons'});
const actionButtonsDiv = makeElement(app, 'div', {id: 'action-buttons'});
const colorPicker = makeElement(toolButtonsDiv, 'input', {
    id: 'color-picker', type: 'color'
});
makeElement(toolButtonsDiv, 'br');
makeElement(toolButtonsDiv, 'label', {
    htmlFor: 'sticker-rotation-slider', innerHTML: "Sticker rotation"
});
const stickerRotationSlider = makeElement(toolButtonsDiv, 'input', {
    id: 'sticker-rotation-slider', type: 'range',
    min: '0', max: '360', value: '0'
});
makeElement(toolButtonsDiv, 'br');

// Canvas Operations

function drawingUndo(): boolean {
    if (undoStack.length > 0) {
        redoStack.push(undoStack.pop()!);
        return true;
    }
    return false;
}

function drawingRedo(): boolean {
    if (redoStack.length > 0) {
        undoStack.push(redoStack.pop()!);
        return true;
    }
    return false;
}

/** Clear all drawing commands. */
function drawingClear(): void {
    redoStack.length = 0;
    displayList.length = 0;
}

/** Begin an undo step by caching the current drawing command. */
function drawingBeginUndoStep(): void {
    redoStack.length = 0;
    undoStack.push(drawingTools[drawingTool].makeDrawCommand());
}

/** Retrieve the current undo step. */
function drawingGetUndoStep(): DrawCommand | null {
    if (undoStack.length > 0) return undoStack[undoStack.length - 1];
    else return null;
}

function drawingSetTool(which: string): void {
    drawingTool = which;
    drawingShowCursor();
}

/** Update the canvas with current drawing commands. */
function drawingUpdate(
    canvas: CanvasMaybeOffscreen,
    ctx: CanvasRenderingContext2DMaybeOffscreen
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
    ctx: CanvasRenderingContext2DMaybeOffscreen,
    how: (ctx: CanvasRenderingContext2DMaybeOffscreen) => void
): void {
    ctx.beginPath();
    how(ctx);
    ctx.closePath();
    ctx.stroke();
}

function drawLine(
    ctx: CanvasRenderingContext2DMaybeOffscreen,
    p1: Point, p2: Point
): void {
    drawPath(ctx, ctx => {ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);});
}

function drawCircle(
    ctx: CanvasRenderingContext2DMaybeOffscreen,
    posn: Point, radius: number
): void {
    drawPath(ctx, ctx =>
        ctx.ellipse(posn.x, posn.y, radius, radius, 0, 0, 2 * Math.PI));
}

function drawingExport(where: CanvasMaybeOffscreen): void {
    const cursorWasShown = cursorDrawCommand !== null;
    drawingHideCursor();
    const ctx = getContext2D(where);
    ctx.save();
    ctx.scale(where.width / canvas.width, where.height / canvas.height);
    drawingUpdate(where, ctx);
    if (cursorWasShown) drawingShowCursor();
    ctx.restore();
}

async function drawingExportToDownload(): Promise<void> {
    const target = new OffscreenCanvas(
        EXPORT_DOWNLOAD_RESOLUTION.width,
        EXPORT_DOWNLOAD_RESOLUTION.height
    );
    drawingExport(target);
    const pngData = await target.convertToBlob();
    const url = URL.createObjectURL(pngData);
    download(url, EXPORT_DOWNLOAD_FILENAME);
}

// Tool Implementations

function makeMarkerDrawCommand(options: MarkerOptions) {
    return {
        color: colorPicker.value,
        points: [] as Point[],
        get posn(): Point {
            if (this.points.length > 0) return this.points[this.points.length - 1];
            else return {x: NaN, y: NaN};
        },
        move(posn: Point) {this.points.push(posn);},
        draw(ctx: CanvasRenderingContext2DMaybeOffscreen) {
            ctx.strokeStyle = this.color;
            ctx.lineWidth = options.lineWidth;
            forEachAdjacentPair(this.points, (p1, p2) => drawLine(ctx, p1, p2));
        }
    };
}

function makeCircleCursorDrawCommand(options: CircleOptions) {
    return {
        posn: {x: NaN, y: NaN},
        move(posn: Point) {this.posn = posn;},
        draw(ctx: CanvasRenderingContext2DMaybeOffscreen) {
            ctx.strokeStyle = colorPicker.value;
            ctx.lineWidth = 1;
            drawCircle(ctx, this.posn, options.radius);
        }
    };
}

function makeStickerDrawCommand(options: StickerOptions) {
    return {
        rotation: Number(stickerRotationSlider.value),
        posn: {...(cursorDrawCommand?.posn || {x: NaN, y: NaN})},
        move(posn: Point) {this.posn = posn;},
        draw(ctx: CanvasRenderingContext2DMaybeOffscreen) {
            ctx.save();
            ctx.translate(this.posn.x, this.posn.y);
            ctx.rotate(this.rotation * Math.PI / 180);
            ctx.scale(0.25, 0.25);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = STICKER_TEXT_STYLE;
            ctx.fillText(options.text, 0, 0);
            ctx.restore();
        }
    };
}

function makeMarkerDrawingTool(options: MarkerOptions): DrawingTool {
    return {
        makeDrawCommand(): DrawCommand {
            return makeMarkerDrawCommand({...options});
        },
        makeCursorDrawCommand(): DrawCommand {
            return makeCircleCursorDrawCommand({radius: options.lineWidth / 2});
        }
    };
}

function makeStickerDrawingTool(options: StickerOptions): DrawingTool {
    return {
        makeDrawCommand(): DrawCommand {
            return makeStickerDrawCommand({...options});
        },
        makeCursorDrawCommand(): DrawCommand {
            return this.makeDrawCommand();
        }
    };
}

// Tool and Action Button Initialization

function makeToolButton(toolName: string): HTMLButtonElement {
    return makeElement(toolButtonsDiv, 'button', {
        innerHTML: toolName,
        onclick: _ => {
            if (drawingTool !== toolName) {
                drawingSetTool(toolName);
                toolButtonsDiv.dispatchEvent(new Event('tool-changed'));
                canvas.dispatchEvent(new Event('tool-moved'));
            }
        }
    }, elem => toolButtonsDiv.addEventListener('tool-changed', _ => {
        elem.disabled = (drawingTool === toolName);
    }, true));
}

function makeActionButton(name: string, doWhat: () => void): HTMLButtonElement {
    return makeElement(actionButtonsDiv, 'button', {
        innerHTML: name,
        onclick: _ => {
            doWhat();
            canvas.dispatchEvent(new Event('drawing-changed'));
        }
    });
}

// Handler function for custom sticker creation
function defineCustomSticker(options: {text: string}): DrawingTool {
    if (options.text in drawingTools) {
        return drawingTools[options.text];
    } else {
        const result = makeStickerDrawingTool(options);
        drawingTools[options.text] = result;
        makeToolButton(options.text);
        return result;
    }
}

function tryDefineCustomStickerFromPrompt(): DrawingTool | null {
    const text = prompt("Sticker text");
    if (text === null) return null;
    else {
        const result = defineCustomSticker({text});
        drawingSetTool(text);
        return result;
    }
}

// Initialize tool and action buttons
for (const toolName of Object.keys(drawingTools)) makeToolButton(toolName);

for (const action of [
    {name: "Undo", doWhat: drawingUndo},
    {name: "Redo", doWhat: drawingRedo},
    {name: "Clear", doWhat: drawingClear},
    {name: "Custom sticker...", doWhat: tryDefineCustomStickerFromPrompt},
    {name: "Export...", doWhat: drawingExportToDownload}
]) makeActionButton(action.name, action.doWhat);

// Register Event Listeners

canvas.addEventListener('mousedown', ev => {
    if (ev.button === LEFT_CLICK) {
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
        (ev.buttons & LEFT_CLICK_FLAG) === LEFT_CLICK_FLAG &&
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

// Runtime Initialization

drawingSetTool("Thin Marker");
toolButtonsDiv.dispatchEvent(new Event('tool-changed'));