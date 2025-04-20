# SPH (Smoothed Particle Hydrodynamics) 유체 시뮬레이션

WebGPU를 사용한 2D SPH 유체 시뮬레이션 예제입니다.

## 개요

이 프로젝트는 SPH(Smoothed Particle Hydrodynamics) 알고리즘을 이용해 실시간으로 유체를 시뮬레이션합니다. WebGPU API를 사용하여 GPU에서 병렬 계산을 수행함으로써 높은 성능을 제공합니다.

## SPH 알고리즘

SPH는 유체를 개별 입자들로 표현하는 메시 없는(meshless) 라그랑지안 방법입니다. 주요 단계는 다음과 같습니다:

1. **밀도 계산**: 각 입자의 밀도를 주변 입자의 영향을 고려하여 계산
2. **압력 계산**: 계산된 밀도에 기반하여 압력 결정
3. **힘 계산**: 압력 구배, 점성력, 외부 힘(중력 등) 계산
4. **적분**: 계산된 힘을 바탕으로 속도와 위치 업데이트

## 사용법

1. 브라우저에서 페이지를 열면 자동으로 시뮬레이션이 시작됩니다.
2. 슬라이더를 사용하여 다음과 같은 파라미터를 조절할 수 있습니다:
   - 입자 수: 시뮬레이션의 입자 개수 변경
   - 중력: 중력 상수 조절
   - 점성: 유체의 점성도 조절
   - 밀도: 목표 밀도 조절
   - 시간 배율: 시뮬레이션 속도 조절
   - 입자 반지름: 렌더링되는 입자의 크기 조절

3. '재설정' 버튼을 클릭하여 시뮬레이션을 초기화할 수 있습니다.
4. 마우스/터치로 화면을 클릭하고 드래그하여 유체에 힘을 가할 수 있습니다.

## 시스템 요구사항

- WebGPU를 지원하는 브라우저 (Chrome 113+, Edge 113+, 또는 WebGPU 활성화된 Firefox)
- GPU 가속이 가능한 하드웨어

## 기술적 세부사항

- **WebGPU**: 그래픽과 계산 파이프라인을 위한 최신 웹 API
- **WGSL**: WebGPU Shading Language로 작성된 컴퓨트 및 렌더링 셰이더
- **SPH 커널**: Poly6, Spiky, Viscosity 커널 사용

## 참고 자료

- [Smoothed Particle Hydrodynamics: A Meshfree Particle Method](https://www.researchgate.net/publication/265455797_Smoothed_Particle_Hydrodynamics_A_Meshfree_Particle_Method)
- [WebGPU API Documentation](https://gpuweb.github.io/gpuweb/)
- [Real-time Fluid Dynamics for Games by Jos Stam](https://www.dgp.toronto.edu/public_user/stam/reality/Research/pdf/GDC03.pdf) 