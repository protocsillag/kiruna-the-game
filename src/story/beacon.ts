import * as THREE from 'three';
import { groundHeight } from '../world/terrain';

const HEIGHT = 26;

/** A soft column of light over the current objective. Fades out as you get close. */
export class Beacon {
  private mat = new THREE.ShaderMaterial({
    uniforms: { opacity: { value: 0 }, time: { value: 0 } },
    vertexShader: /* glsl */ `
      varying float vY;
      void main() {
        vY = position.y / ${HEIGHT.toFixed(1)} + 0.5;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float opacity;
      uniform float time;
      varying float vY;
      void main() {
        float fade = (1.0 - vY) * smoothstep(0.0, 0.06, vY);
        float pulse = 0.75 + 0.25 * sin(time * 1.6 - vY * 6.0);
        gl_FragColor = vec4(vec3(1.0, 0.84, 0.6) * pulse, fade * opacity);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  private mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, HEIGHT, 20, 1, true), this.mat);
  private target: THREE.Vector3 | null = null;
  private level = 0;

  constructor(scene: THREE.Scene) {
    this.mesh.visible = false;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }

  point(at: THREE.Vector3 | null): void {
    this.target = at;
    if (at) this.mesh.position.set(at.x, groundHeight(at.x, at.z) + HEIGHT / 2 - 0.3, at.z);
  }

  update(dt: number, player: THREE.Vector3): void {
    let want = 0;
    if (this.target) {
      const d = Math.hypot(player.x - this.target.x, player.z - this.target.z);
      want = THREE.MathUtils.clamp((d - 6) / 14, 0, 1) * 0.55;
    }
    this.level += (want - this.level) * Math.min(1, dt * 2);
    this.mat.uniforms.opacity.value = this.level;
    this.mat.uniforms.time.value += dt;
    this.mesh.visible = this.level > 0.01;
  }
}
