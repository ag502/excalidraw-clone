/* eslint-disable no-undef */
import React, { useCallback, useEffect, useLayoutEffect, useState } from "react";
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
function generateShape(element) {
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
    const shape = generator.rectangle(
      element.x,
      element.y,
      element.width,
      element.height
    );
    element.draw = (rc, context) => {
      rc.draw(shape);
    }
  } else if (element.type === "ellipse") {
    const shape = generator.ellipse(
      element.x + element.width / 2,
      element.y + element.height / 2,
      element.width,
      element.height
    );
    element.draw = (rc, context) => {
      rc.draw(shape);
    };
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
    element.draw = (rc, context) => {
      const font = context.font;
      context.font = element.font;
      const height = element.measure.actualBoundingBoxAscent + element.measure.actualBoundingBoxDescent;
      context.fillText(
        element.text,
        element.x,
        element.y + 2 * element.measure.actualBoundingBoxAscent - height / 2
      );
      context.font = font;
    }
  } else {
    throw new Error(`Unimplemented type ${element.type}`);
  }
}

/**
 * @param {newElement} selection selectionElement
 * @description selection element에 elements 배열의 원소가 포함되는지 파악하는 함수
 */
function setSelection(selection) {
  // Fix up negative width and height when dragging from right to left
  // Note: it's a lot harder to do on mouse move because of rounding issues
  let {x, y, width, height} = selection;

  // selection element를 오른쪽에서 왼쪽으로 드래그할 때, 넒이가 음수가 됨
  if (width < 0) {
    // selection element의 시작 x점을 왼쪽으로 이동
    x += width;
    // width에 절댓값
    width = - width;
  }

  // selection element를 아래에서 위로 드래그할 때, 높이가 음수가 됨
  if (height < 0) {
    // selection element의 시작 y점을 위로 이동
    y += height;
    height = - height;
  }

  // selection보다 element가 작으면 isSelected를 true로 설정
  elements.forEach(element => {
    element.isSelected = 
      element.type !== 'selection' &&
      x <= element.x &&
      y <= element.y &&
      x + width >= element.x + element.width &&
      y + height >= element.y + element.height
  })
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

  const onKeyDown = useCallback((event) => {
    if (event.key === 'Backspace') {
      // Backspace를 누르면 선택된 element들을 뒤에서 부터 모두 제거
      for (let i = elements.length - 1; i >= 0; i--) {
        if (elements[i].isSelected) {
          elements.splice(i, 1);
        }
      }
      drawScene();
    }
  }, [])

  useEffect(() => {
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
    }
  }, [onKeyDown])

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
          const x = e.clientX - e.target.offsetLeft;
          const y = e.clientY - e.target.offsetTop;
          const element = newElement(elementType, x, y);

          if (elementType === 'text') {
            element.text = prompt("What text do you want?");
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
          generateShape(element);
          elements.push(element);

          if (elementType === 'text') {
            // text element는 드래그 요소가 아님
            setDraggingElement(null);
          } else {
            setDraggingElement(element);
          }
          drawScene();
        }}
        onMouseUp={e => {
          // 오른쪽에서 왼쪽, 아래에서 위로 드래그되는 도형의 좌표 보정
          // Fix up negative width and height when dragging from right to left
          // Note: it's a lot harder to do on mouse move because of rounding issues
          if (draggingElement.width < 0) {
            draggingElement.x += draggingElement.width;
            draggingElement.width = -draggingElement.width;
          }
          if (draggingElement.height < 0) {
            draggingElement.y += draggingElement.height;
            draggingElement.height = -draggingElement.height;
          }

          if (elementType === 'selection') {
            elements.forEach(element => {
              element.isSelected = false;
            })
          }
          setDraggingElement(null);
          if (elementType === 'selection') {
            // selection element 드래그를 멈췄을 때, elements에서 제거
            elements.pop();
            setSelection(draggingElement);
          }
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
            setSelection(draggingElement);
          }
          drawScene();
        }}
      />
    </div>
  )
}

const rootElement = document.getElementById("root");
ReactDOM.render(<App />, rootElement);


const canvas = document.getElementById("canvas");
const rc = rough.canvas(canvas);
const context = canvas.getContext("2d");

function drawScene() {
  // 그리기 전에 모두 지우지 않으면, mouseMove시 흔적들이 모두 그려짐
  context.clearRect(0, 0, canvas.width, canvas.height);

  elements.forEach(element => {
    element.draw(rc, context);

    // element가 선택되었을때, 생성되는 테두리
    if (element.isSelected) {
      const margin = 4;
      
      const lineDash = context.getLineDash();

      context.setLineDash([8, 4]);
      context.strokeRect(
        element.x - margin,
        element.y - margin,
        element.width + margin * 2,
        element.height + margin * 2
      )
      context.setLineDash(lineDash);
    }
  })
}