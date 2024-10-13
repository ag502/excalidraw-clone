/* eslint-disable no-undef */
import React from "react";
import ReactDOM from "react-dom";
import rough from "roughjs/dist/rough.umd.js";

import "./styles.css";

const elements = [];

/**
 * @param {*} x1 
 * @param {*} y1 
 * @param {*} x2 
 * @param {*} y2 
 * @param {*} angle 
 * @returns 
 * 
 * @description `x2`, `y2` 좌표를 축으로 `x1`, `y1` 좌표를 `angle` 만큼 회전시키는 함수
 */
function rotate(x1, y1, x2, y2, angle) {
  // 𝑎′𝑥=(𝑎𝑥−𝑐𝑥)cos𝜃−(𝑎𝑦−𝑐𝑦)sin𝜃+𝑐𝑥
  // 𝑎′𝑦=(𝑎𝑥−𝑐𝑥)sin𝜃+(𝑎𝑦−𝑐𝑦)cos𝜃+𝑐𝑦.
  // https://math.stackexchange.com/questions/2204520/how-do-i-rotate-a-line-segment-in-a-specific-point-on-the-line
  return [
    (x1 - x2) * Math.cos(angle) - (y1 - y2) * Math.sin(angle) + x2,
    (x1 - x2) * Math.sin(angle) + (y1 - y2) * Math.cos(angle) + y2
  ]
}

/**
 * @param {*} type 
 * @param {number} x 도형이 시작되는 x 좌표
 * @param {number} y 도형이 시작되는 y 좌표
 * 
 * @description `element`의 타입, 시작되는 좌표, 넓이, 높이를 반환하는 함수.
 */
function newElement(type, x, y) {
  const element = {
    type,
    x,
    y,
    width: 0,
    height: 0,
    isSelected: false
  }
  return element;
}

const generator = rough.generator();

/**
 * @param {newElement} element 
 * @description `newElement` 에서 만들어진 `element` 객체에 `element`를 그리는 `draw`함수를 추가하는 함수
 */
function generateDraw(element) {
  if (element.type === "selection") {
    // rc - rough canvas
    // context - canvas rendering context
    element.draw = (rc, context) => {
      // context의 원래 fillStyle 저장
      const fillStyle = context.fillStyle;
      context.fillStyle = "rgba(0, 0, 255, 0.10)";
      context.fillRect(element.x, element.y, element.width, element.height);
      context.fillStyle = fillStyle;
    };
  } else if (element.type === "rectangle") {
    const shape = generator.rectangle(0, 0, element.width, element.height);

    element.draw = (rc, context) => {
      // 화살표 이동시 generateShape을 호출하지 않기 위해, 변경된 좌표를 draw함수에서 반영
      // element의 x, y 좌표만 변경해도 그릴때 반영되게끔 수정
      context.translate(element.x, element.y);
      rc.draw(shape);
      // 그린후, context의 상태로 복원
      context.translate(-element.x, -element.y);
    }
  } else if (element.type === "ellipse") {
    const shape = generator.ellipse(
      element.width / 2,
      element.height / 2,
      element.width,
      element.height
    );
    element.draw = (rc, context) => {
      context.translate(element.x, element.y);
      rc.draw(shape);
      context.translate(-element.x, -element.y);
    };
  } else if (element.type === 'arrow') {
    const x1 = 0;
    const y1 = 0;
    const x2 = element.width;
    const y2 = element.height;

    const size = 30; // pixel
    const distance = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));

    // 화살표 꼭지 좌표 위치 및 크기 결정하는 로직
    // Scale down the arrow until we hit a certain size so that it doesn't look weird
    const minSize = Math.min(size, distance / 2);
    const xs = x2 - ((x2 - x1) / distance) * minSize;
    const ys = y2 - ((y2 - y1) / distance) * minSize;

    // 화살표 꼭지 좌표
    const angle = 20; // degrees
    const [x3, y3] = rotate(xs, ys, x2, y2, (-angle * Math.PI) / 180);
    const [x4, y4] = rotate(xs, ys, x2, y2, (angle * Math.PI) / 180);

    const shapes = [
      //      \
      generator.line(x3, y3, x2, y2),
      // ------
      generator.line(x1, y1, x2, y2),
      //      /
      generator.line(x4, y4, x2, y2)
    ];

    element.draw = (rc, context) => {
      context.translate(element.x, element.y);
      shapes.forEach(shape => rc.draw(shape));
      context.translate(-element.x, -element.y);
    }
  } else if (element.type === 'text') {
    element.draw = (rc, context) => {
      const font = context.font;
      context.font = element.font;
      context.fillText(
        element.text,
        element.x,
        element.y + element.measure.actualBoundingBoxAscent
      );
      context.font = font;
    }
  } else {
    throw new Error(`Unimplemented type ${element.type}`);
  }
}

// If the element is created from right to left, the width is going to be negative
// This set of functions retrieves the absolute position of the 4 points.
// We can't just always normalize it since we need to remember the fact that an arrow
// is pointing left or right.
// x1, y1은 element의 시작점, x2, y2는 element의 끝점
/**
 * @param {newElement} element 
 * @returns 
 * @description width가 음수일 경우, 시작점에서 width를 더해 시작점 좌표를 보정
 */
function getElementAbsoluteX1(element) {
  return element.width >= 0 ? element.x : element.x + element.width;
}

function getElementAbsoluteX2(element) {
  return element.width >= 0 ? element.x + element.width : element.x;
}

function getElementAbsoluteY1(element) {
  return element.height >= 0 ? element.y : element.y + element.height;
}

function getElementAbsoluteY2(element) {
  return element.height >= 0 ? element.y + element.height : element.y;
}

/**
 * @param {newElement} selection selectionElement
 * @description selection element에 elements 배열의 원소가 포함되는지 파악하는 함수
 */
function setSelection(selection) {
  // selection element의 시작점과 끝점의 음수 넓이, 높이를 보정
  const selectionX1 = getElementAbsoluteX1(selection);
  const selectionX2 = getElementAbsoluteX2(selection);
  const selectionY1 = getElementAbsoluteY1(selection);
  const selectionY2 = getElementAbsoluteY2(selection);

  // selection보다 element가 작으면 isSelected를 true로 설정
  elements.forEach(element => {
    const elementX1 = getElementAbsoluteX1(element);
    const elementX2 = getElementAbsoluteX2(element);
    const elementY1 = getElementAbsoluteY1(element);
    const elementY2 = getElementAbsoluteY2(element);

    element.isSelected = 
      element.type !== 'selection' &&
      selectionX1 <= elementX1 &&
      selectionY1 <= elementY1 &&
      selectionX2 >= elementX2 &&
      selectionY2 >= elementY2
  })
}

function clearSelection() {
  elements.forEach(element => {
    element.isSelected = false;
  })
}

function ElementOption({ type, elementType, onElementTypeChange, children }) {
  return (
    <label>
      <input
        type="radio"
        checked={elementType === type}
        onChange={() => {
          onElementTypeChange(type);
          clearSelection();
          drawScene();
        }}
      />
      {children}
    </label>
  );
}

class App extends React.Component {
  componentDidMount() {
    this.onKeyDown = (event) => {
      if (event.key === 'Backspace') {
        // Backspace를 누르면 선택된 element들을 뒤에서 부터 모두 제거
        for (let i = elements.length - 1; i >= 0; i--) {
          if (elements[i].isSelected) {
            elements.splice(i, 1);
          }
        }
        drawScene();
        event.preventDefault();
        // 방향키로 선택된 element들을 이동
      } else if (
        event.key === 'ArrowLeft' ||
        event.key === 'ArrowRight' ||
        event.key === 'ArrowUp' ||
        event.key === "ArrowDown"
      ) {
        // shift key를 같이 누르면 step을 5로 설정
        const step = event.shiftKey ? 5 : 1;
        elements.forEach(element => {
          if (element.isSelected) {
            if (event.key === 'ArrowLeft') element.x -= step;
            else if (event.key === 'ArrowRight') element.x += step;
            else if (event.key === 'ArrowUp') element.y -= step;
            else if (event.key === 'ArrowDown') element.y += step;
          }
        })
        drawScene();
        // 키보드의 원래 동작을 막기위해 호출 (ex-키보드 아래방향키를 누를때, 스크롤 이동 방지)
        event.preventDefault();
      }
    }
    document.addEventListener("keydown", this.onKeyDown);
  }

  componentWillUnmount() {
    document.removeEventListener("keydown", this.onKeyDown);
  }

  constructor() {
    super();
    this.state = {
      draggingElement: null,
      elementType: "selection"
    }
  }

  setElementType(type) {
    this.setState({ elementType: type})
  }

  render() {
    return (
      <div>
        <ElementOption type="rectangle" elementType={this.state.elementType} onElementTypeChange={this.setElementType.bind(this)}>Rectangle</ElementOption>
        <ElementOption type="ellipse" elementType={this.state.elementType} onElementTypeChange={this.setElementType.bind(this)}>Ellipse</ElementOption>
        <ElementOption type="arrow" elementType={this.state.elementType} onElementTypeChange={this.setElementType.bind(this)}>Arrow</ElementOption>
        <ElementOption type="text" elementType={this.state.elementType} onElementTypeChange={this.setElementType.bind(this)}>Text</ElementOption>
        <ElementOption type="selection" elementType={this.state.elementType} onElementTypeChange={this.setElementType.bind(this)}>Selection</ElementOption>

        <canvas 
          id="canvas"
          width={window.innerWidth}
          height={window.innerHeight}
          onMouseDown={e => {
            const x = e.clientX - e.target.offsetLeft;
            const y = e.clientY - e.target.offsetTop;
            const element = newElement(this.state.elementType, x, y);

            // 마우스 클릭 위치가 선택된 element내부인지 여부
            // 드래그로 element를 옮기려고 하는 경우인지 여부
            let isDraggingElements = false;
            const cursorStyle = document.documentElement.style.cursor;
            if (this.state.elementType === 'selection') {
              // selection element일 때, 마우스를 클릭하는 좌표가 선택된 element들 중 하나의 내부라면
              // isDraggingElement를 true로 변경
              isDraggingElements = elements.some(el => {
                if (el.isSelected) {
                  const minX = Math.min(el.x, el.x + el.width);
                  const maxX = Math.max(el.x, el.x + el.width);
                  const minY = Math.min(el.y, el.y + el.height);
                  const maxY = Math.max(el.y, el.y + el.height);
                  return minX <= x && x <= maxX && minY <= y && y <= maxY;
                }
              })
              // 선택된 element의 내부라면 cursor 모양 변경
              if (isDraggingElements) {
                document.documentElement.style.cursor = "move";
              }
            }

            if (this.state.elementType === 'text') {
              const text = prompt("What text do you want?");
              if (text === null) {
                return;
              }
              element.text = text;
              element.font = "20px Virgil";
              // context의 원래 font 저장
              const font = context.font;
              // element font로 context font 변경
              context.font = element.font;
              element.measure = context.measureText(element.text);
              // context의 원래 font로 변경
              context.font = font;
              const height = element.measure.actualBoundingBoxAscent + element.measure.actualBoundingBoxDescent;
              // text 가운데 정렬
              element.x -= element.measure.width / 2;
              element.y -= element.measure.actualBoundingBoxAscent;
              element.width = element.measure.width;
              element.height = height
            }
            generateDraw(element);
            elements.push(element);

            if (this.state.elementType === 'text') {
              // text element는 드래그 요소가 아님
              this.setState({ 
                draggingElement: null,
                elementType: "selection"
              });
              // 생성된 text가 선택되도록 구현
              element.isSelected = true;
            } else {
              this.setState({ draggingElement: element });
            }

            // lastX, lastY의 초깃값은 마우스 클릭의 시작점 좌표로 설정
            let lastX = x;
            let lastY = y;

            const onMouseMove = (e) => {
              // 도형을 드래그로 이동하려고 하는 경우
              if (isDraggingElements) {
                const selectedElements = elements.filter(element => element.isSelected);
                if (selectedElements.length) {
                  const x = e.clientX - e.target.offsetLeft;
                  const y = e.clientY - e.target.offsetTop;
                  // 선택된 element들을 드래그한 거리만큼 이동
                  elements.forEach(element => {
                    element.x += x - lastX;
                    element.y += y - lastY;
                  });
                  lastX = x;
                  lastY = y;
                  drawScene();
                  return;
                }
              }

              const draggingElement = this.state.draggingElement;
              if (!draggingElement) return;
              // e.clientX - e.target.offsetLeft는 현재 마우스 포인터의 x 좌표
              // draggingElement.x 는 현재 생성중인 element의 시작 x 좌표
              // 현재 마우스 포인터 위치에서 element의 시작 좌표를 빼면 넓이가 나옴
              let width = e.clientX - e.target.offsetLeft - draggingElement.x;
              let height = e.clientY - e.target.offsetTop - draggingElement.y;
              draggingElement.width = width;
              // Make a perfect square or circle when shift is enabled
              // shift를 누른 상태에서 드래그한다면 정비율로 확대되어야 함
              draggingElement.height = e.shiftKey ? width : height;
              // 생성할 element의 넓이와 높이값 업데이트를 위한 호출
              generateDraw(draggingElement);

              if (this.state.elementType === 'selection') {
                setSelection(draggingElement);
              }
              drawScene();
            }

            const onMouseUp = (e) => {
              window.removeEventListener("mousemove", onMouseMove);
              window.removeEventListener("mouseup", onMouseUp);
              document.documentElement.style.cursor = cursorStyle;

              const draggingElement = this.state.draggingElement;
              if (!draggingElement) return;

              if (this.state.elementType === 'selection') {
                // 드래그로 element를 이동하는 경우
                if (isDraggingElements) {
                  isDraggingElements = false;
                } else {
                  setSelection(draggingElement);
                }
                // selection element 드래그를 멈췄을 때, elements에서 제거
                elements.pop();
              } else {
                // 마지막으로 생성한 element를 선택
                draggingElement.isSelected = true;
              }
              // element를 다 생성한 후, selection으로 복귀
              this.setState({
                draggingElement: null,
                elementType: "selection"
              })
              drawScene();
            }

            window.addEventListener("mousemove", onMouseMove);
            window.addEventListener("mouseup", onMouseUp);

            drawScene();
          }}
        />
      </div>
    )
  }
}

const rootElement = document.getElementById("root");
ReactDOM.render(<App />, rootElement);


const canvas = document.getElementById("canvas");
const rc = rough.canvas(canvas);
const context = canvas.getContext("2d");

// Big hack to ensure that all the 1px lines are drawn at 1px instead of 2px
// https://stackoverflow.com/questions/13879322/drawing-a-1px-thick-line-in-canvas-creates-a-2px-thick-line/13879402#comment90766599_13879402
context.translate(0.5, 0.5);

function drawScene() {
  // 그리기 전에 모두 지우지 않으면, mouseMove시 흔적들이 모두 그려짐
  // -0.5, -0.5로 하는 이유는 원점밖으로 나가서 그려지는 도형을 지우려고?
  context.clearRect(-0.5, -0.5, canvas.width, canvas.height);

  elements.forEach(element => {
    element.draw(rc, context);

    // element가 선택되었을때, 생성되는 테두리
    if (element.isSelected) {
      const margin = 4;
      
      const lineDash = context.getLineDash();

      // 없어도 되는게 아닐지..?
      const elementX1 = getElementAbsoluteX1(element);
      const elementX2 = getElementAbsoluteX2(element);
      const elementY1 = getElementAbsoluteY1(element);
      const elementY2 = getElementAbsoluteY2(element);

      context.setLineDash([8, 4]);
      context.strokeRect(
        elementX1 - margin,
        elementY1 - margin,
        elementX2 - elementX1 + margin * 2,
        elementY2 - elementY1 + margin * 2
      )
      context.setLineDash(lineDash);
    }
  })
}