import React, { useEffect, useLayoutEffect, useState } from "react";
import ReactDOM from "react-dom/client";
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
 * @param {*} x 도형이 시작되는 x 좌표
 * @param {*} y 도형이 시작되는 y 좌표
 * 
 * @description `element`의 타입, 시작되는 좌표, 넓이, 높이를 반환하는 함수. 내부적으로 `generateShape`을 호출하고 있음
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
  generateShape(element);
  return element;
}

const generator = rough.generator();

/**
 * @param {*} element 
 * @description `newElement` 에서 만들어진 `element` 객체에 `element`를 그리는 `draw`함수를 추가하는 함수
 */
function generateShape(element) {
  if (element.type === "selection") {
    // rc - rough canvas
    // context - canvas rendering context
    element.draw = (rc, context) => {
      context.fillStyle = "rgba(0, 0, 255, 0.10)";
      context.fillRect(element.x, element.y, element.width, element.height);
    };
  } else if (element.type === "rectangle") {
    const shape = generator.rectangle(
      element.x,
      element.y,
      element.width,
      element.height
    );
    element.draw = (rc, context) => {
      rc.draw(shape);
    }
  } else if (element.type === 'arrow') {
    const x1 = element.x;
    const y1 = element.y;
    const x2 = x1 + element.width;
    const y2 = y1 + element.height;

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
      generator.line(x1, y1, x2, y2),
      generator.line(x3, y3, x2, y2),
      generator.line(x4, y4, x2, y2)
    ];

    element.draw = (rc, context) => {
      shapes.forEach(shape => rc.draw(shape));
    }
  } else if (element.type === 'text') {
    if (element.text === undefined) {
      element.text = prompt("What text do you want?");
    }
    element.draw = (rc, context) => {
      context.font = "20px Virgil";
      const measure = context.measureText(element.text);
      const height = measure.actualBoundingBoxAscent + measure.actualBoundingBoxDescent;
      context.fillText(
        element.text,
        element.x - measure.width / 2,
        element.y + measure.actualBoundingBoxAscent - height / 2
      );
    }
  } else {
    throw new Error(`Unimplemented type ${element.type}`);
  }
}

function ElementOption({ type, elementType, onElementTypeChange, children }) {
  return (
    <label>
      <input
        type="radio"
        checked={elementType === type}
        onChange={() => onElementTypeChange(type)}
      />
      {children}
    </label>
  );
}

function App() {
  const [draggingElement, setDraggingElement] = useState(null);
  const [elementType, setElementType] = useState("selection");
  const [selectedElements, setSelectedElement] = useState([]);

  return (
    <div>
      <ElementOption type="rectangle" elementType={elementType} onElementTypeChange={setElementType}>Rectangle</ElementOption>
      <ElementOption type="ellipse" elementType={elementType} onElementTypeChange={setElementType}>Ellipse</ElementOption>
      <ElementOption type="arrow" elementType={elementType} onElementTypeChange={setElementType}>Arrow</ElementOption>
      <ElementOption type="text" elementType={elementType} onElementTypeChange={setElementType}>Text</ElementOption>
      <ElementOption type="selection" elementType={elementType} onElementTypeChange={setElementType}>Selection</ElementOption>
      <canvas 
        id="canvas"
        width={window.innerWidth}
        height={window.innerHeight}
        onMouseDown={e => {
          const element = newElement(
            elementType,
            e.clientX - e.target.offsetLeft,
            e.clientY - e.target.offsetTop
          );
          elements.push(element);
          setDraggingElement(element);
          drawScene();
        }}
        onMouseUp={e => {
          if (elementType === 'selection') {
            elements.forEach(element => {
              element.isSelected = false;
            })
          }
          setDraggingElement(null);
          drawScene();
        }}
        onMouseMove={e => {
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
          generateShape(draggingElement);

          if (elementType === 'selection') {
            elements.forEach(element => {
              // draggingElement는 selection element
              element.isSelected = 
                draggingElement.x <= element.x &&
                draggingElement.y <= element.y &&
                draggingElement.x + draggingElement.width >= element.x + element.width &&
                draggingElement.y + draggingElement.height >= element.y + element.height
            })
          }
          drawScene();
        }}
      />
    </div>
  )
}

const rootElement = document.getElementById("root");
const root = ReactDOM.createRoot(rootElement);
root.render(<App/>);



function drawScene() {
  const canvas = document.getElementById("canvas");
  const rc = rough.canvas(canvas);
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);

  elements.forEach(element => {
    element.draw(rc, context);

    // element가 선택되었을때, 생성되는 테두리
    if (element.isSelected) {
      const margin = 4;
      context.setLineDash([8, 4]);
      context.strokeRect(
        element.x - margin,
        element.y - margin,
        element.width + margin * 2,
        element.height + margin * 2
      )
      context.setLineDash([]);
    }
  })
}