/* Robotaxi bodywork in game units. The nose points toward negative Z. */
(function () {
  "use strict";
  const WG = window.WG;
  WG.modelName = (model) => (model === "ojai" ? "Waymo Ojai" : "Jaguar I-PACE");
  WG.randomVehicleModel = () => (Math.random() < 0.5 ? "ipace" : "ojai");

  // Each station gives longitudinal position, half width, shoulder and crown height.
  const shapes = {
    ipace: {
      paint: "#f1f5f7",
      roof: "#263644",
      axle: 1.44,
      body: [
        [-2.31, 0.68, 0.85, 0.92],
        [-2.19, 0.88, 0.98, 1.02],
        [-1.53, 0.99, 1.09, 1.14],
        [-0.94, 0.97, 1.15, 1.21],
        [0.48, 0.97, 1.19, 1.25],
        [1.49, 1, 1.25, 1.3],
        [2.15, 0.91, 1.16, 1.21],
        [2.29, 0.78, 1.04, 1.12],
      ],
      glass: [
        [-1.24, 0.85, 1.15, 1.17],
        [-0.46, 0.89, 1.18, 1.76],
        [-0.18, 0.9, 1.19, 1.83],
        [0.7, 0.9, 1.22, 1.82],
        [1.24, 0.89, 1.24, 1.69],
        [1.92, 0.85, 1.2, 1.24],
      ],
      pillars: [-0.11, 0.95],
      lidarY: 2.2,
      lidarZ: 0.15,
    },
    ojai: {
      paint: "#9cd7ed",
      roof: "#abdff1",
      axle: 1.52,
      body: [
        [-2.34, 0.69, 0.91, 0.99],
        [-2.22, 0.89, 1.02, 1.09],
        [-1.85, 0.97, 1.12, 1.19],
        [-1.42, 0.98, 1.14, 1.21],
        [1.56, 0.98, 1.15, 1.22],
        [2.14, 0.94, 1.11, 1.18],
        [2.3, 0.76, 1.01, 1.09],
      ],
      glass: [
        [-1.98, 0.85, 1.14, 1.18],
        [-1.46, 0.93, 1.15, 1.86],
        [-1.16, 0.94, 1.15, 2.0],
        [1.38, 0.94, 1.16, 2.0],
        [1.77, 0.91, 1.16, 1.92],
        [2.13, 0.84, 1.13, 1.24],
      ],
      pillars: [-0.58, 0.5, 1.49],
      lidarY: 2.37,
      lidarZ: -0.47,
    },
  };
  WG.vehicleShape = (model) => shapes[model === "ojai" ? "ojai" : "ipace"];

  function sample(rows, z) {
    let i = 1;
    while (i < rows.length - 1 && rows[i][0] < z) i++;
    const a = rows[i - 1],
      b = rows[i],
      t = (z - a[0]) / (b[0] - a[0]);
    return a.slice(1).map((x, j) => x + (b[j + 1] - x) * t);
  }

  // Heights for props near the centreline, including birds perched on the lidar.
  WG.vehicleTop = function (model, x, z) {
    const shape = WG.vehicleShape(model);
    if (Math.hypot(x, z - shape.lidarZ) < 0.37) return shape.lidarY + 0.12;
    const rows =
      z >= shape.glass[0][0] && z <= shape.glass[shape.glass.length - 1][0] ? shape.glass : shape.body;
    return sample(rows, z)[2];
  };

  WG.buildVehicleBody = function (model, M, Hd, GEO) {
    const W = WG.world,
      v = WG.vehicleShape(model),
      van = model === "ojai";
    const trim = "#202c37",
      glass = "#334955",
      rim = "#ccd5d9";
    function part(geo, color, x, y, z, sx, sy, sz, rz = 0, target = M) {
      target.geo(geo, color, W.mat(x, y, z, sx, sy, sz, 0, 0, rz));
    }
    // Emit a flat-shaded quad, facing away from the centre of the shell.
    function panel(a, b, c, d, color, target = M) {
      const A = new THREE.Vector3(...a),
        B = new THREE.Vector3(...b),
        C = new THREE.Vector3(...c);
      const n = B.clone().sub(A).cross(C.clone().sub(A)).normalize();
      const centre = A.clone()
        .add(B)
        .add(C)
        .multiplyScalar(1 / 3);
      centre.y -= 1.0;
      const reverse = n.dot(centre) < 0;
      if (reverse) n.negate();
      const rgb = new THREE.Color(color);
      for (const p of reverse ? [a, c, b, a, d, c] : [a, b, c, a, c, d]) {
        target.p.push(...p);
        target.n.push(n.x, n.y, n.z);
        target.c.push(rgb.r, rgb.g, rgb.b);
      }
    }
    function shell(rows, stations, section, colors) {
      let prev;
      for (const z of [...new Set(stations)].sort((a, b) => a - b)) {
        const ring = section(z, ...sample(rows, z)).map(([x, y]) => [x, y, z]);
        if (prev) {
          for (let j = 0; j < ring.length; j++) {
            const k = (j + 1) % ring.length;
            panel(prev[j], prev[k], ring[k], ring[j], colors[j]);
          }
        } else cap(ring, colors[1]);
        prev = ring;
      }
      cap(prev, colors[1]);
    }
    function cap(ring, color) {
      for (let j = 1; j < ring.length / 2; j++)
        panel(ring[j - 1], ring[j], ring[ring.length - 1 - j], ring[ring.length - j], color);
    }
    const stations = v.body.map((r) => r[0]);
    for (const axle of [-v.axle, v.axle]) {
      for (let i = 0; i <= 12; i++) stations.push(axle + 0.49 * Math.cos((Math.PI * i) / 12));
    }
    shell(
      v.body,
      stations,
      (z, w, shoulder, top) => {
        const delta = Math.abs(Math.abs(z) - v.axle);
        const sill = 0.4 + Math.sqrt(Math.max(0, 0.49 * 0.49 - delta * delta));
        return [
          [-w * 0.96, sill],
          [-w, sill + 0.045],
          [-w, shoulder],
          [-w * 0.89, top],
          [w * 0.89, top],
          [w, shoulder],
          [w, sill + 0.045],
          [w * 0.96, sill],
        ];
      },
      [trim, v.paint, v.paint, v.paint, v.paint, v.paint, trim, trim],
    );
    const pane = (z, w, base, top) => [
      [-w, base],
      [-w * 0.84, top - 0.024],
      [-w * 0.74, top],
      [w * 0.74, top],
      [w * 0.84, top - 0.024],
      [w, base],
    ];
    shell(
      v.glass,
      v.glass.map((r) => r[0]),
      pane,
      [glass, trim, v.roof, trim, glass, trim],
    );
    // The sloped centre strip at either end is the windscreen / liftgate glass.
    for (const i of [0, v.glass.length - 2]) {
      const points = (j) => {
        const [z, w, , y] = v.glass[j];
        return [
          [-w * 0.74, y + 0.003, z],
          [w * 0.74, y + 0.003, z],
        ];
      };
      const [a, b] = points(i),
        [d, c] = points(i + 1);
      panel(a, b, c, d, glass);
    }
    for (const side of [-1, 1]) {
      for (const z of v.pillars) {
        function edge(at) {
          const [w, b, t] = sample(v.glass, at);
          return [
            [side * (w + 0.006), b, at],
            [side * (w * 0.84 + 0.006), t - 0.024, at],
          ];
        }
        const [a, b] = edge(z - 0.042),
          [d, c] = edge(z + 0.042);
        panel(a, b, c, d, trim);
      }
      for (const axle of [-v.axle, v.axle]) {
        // Close the wheel well above the tyre, leaving the ground clearance intact.
        for (let i = 0; i < 12; i++) {
          const arch = (angle) => [
            side * 0.88,
            0.4 + 0.495 * Math.sin(angle),
            axle + 0.495 * Math.cos(angle),
          ];
          const a = arch((i * Math.PI) / 12),
            b = arch(((i + 1) * Math.PI) / 12);
          panel(a, b, [b[0], 0.4, b[2]], [a[0], 0.4, a[2]], trim);
        }
        part(GEO.wheel, "#222a30", side * 0.87, 0.4, axle, 1, 1, 1, Math.PI / 2);
        part(GEO.hubG, trim, side * 0.89, 0.4, axle, 1.3, 1, 1.3, Math.PI / 2);
        for (let i = 0; i < 5; i++) {
          const t = (i * 2 * Math.PI) / 5;
          M.geo(
            GEO.box,
            rim,
            W.mat(
              side * 1.068,
              0.4 + 0.115 * Math.cos(t),
              axle + 0.115 * Math.sin(t),
              0.016,
              0.2,
              0.056,
              0,
              t,
              0,
            ),
          );
        }
        part(GEO.cyl, rim, side * 1.08, 0.4, axle, 0.078, 0.02, 0.078, Math.PI / 2);
      }
      part(GEO.sph, v.paint, side * 0.98, 1.27, van ? -1.45 : -0.93, 0.155, 0.11, 0.19);
      part(GEO.sph, trim, side * 1.08, 1.28, van ? -1.48 : -0.96, 0.07, 0.078, 0.1);
      // Flush pulls and a two-colour W on the front doors.
      for (const z of [-0.14, 0.8]) part(GEO.box, trim, side * 0.982, 1.04, z, 0.024, 0.029, 0.17);
      const rockerX = side * 0.983;
      panel(
        [rockerX, 0.45, -0.97],
        [rockerX, 0.53, -0.91],
        [rockerX, 0.6, 0.93],
        [rockerX, 0.45, 0.99],
        van ? "#73aaba" : "#84939f",
      );
      if (van) {
        part(GEO.box, "#577480", side * 0.984, 0.965, 1.12, 0.014, 0.018, 0.75);
      }
      const x = side * 0.983,
        z = -0.54;
      for (const [i, color] of ["#1476cf", "#1476cf", "#08a879", "#08a879"].entries()) {
        const y = i % 2 ? 0.79 : 0.91,
          end = i % 2 ? 0.91 : 0.79;
        panel(
          [x, y, z + i * 0.07],
          [x, y + 0.045, z + i * 0.07],
          [x, end + 0.045, z + (i + 1) * 0.07],
          [x, end, z + (i + 1) * 0.07],
          color,
        );
      }
    }
    const nose = v.body[0][0] - 0.008,
      rear = v.body[v.body.length - 1][0] + 0.008;
    if (van) {
      part(GEO.box, trim, 0, 0.87, nose, 1.35, 0.115, 0.035);
      part(GEO.box, "#edffff", 0, 0.903, nose - 0.02, 1.31, 0.035, 0.016, 0, Hd);
    } else {
      part(GEO.box, trim, 0, 0.74, nose, 0.78, 0.24, 0.035);
      for (let i = -3; i <= 3; i++) part(GEO.box, "#52606b", i * 0.1, 0.74, nose - 0.021, 0.023, 0.18, 0.015);
    }
    for (const s of [-1, 1]) {
      part(GEO.box, "#f4ffff", s * 0.55, van ? 0.86 : 0.853, nose - 0.024, 0.28, 0.056, 0.025, s * 0.09, Hd);
      part(GEO.box, "#cc383e", s * 0.54, van ? 0.96 : 1.0, rear, 0.42, 0.073, 0.04);
    }
    // Wrap the daytime lights around the shoulders and recess the lower intake.
    const front = v.body.slice(0, 2);
    for (const side of [-1, 1]) {
      const edge = ([z, w, y]) => [
        [side * w, y - 0.064, z - 0.004],
        [side * w, y - 0.015, z - 0.004],
      ];
      const [a, b] = edge(front[0]),
        [d, c] = edge(front[1]);
      panel(a, b, c, d, "#e5f8fa", Hd);
      const z = van ? -1.72 : -1.66;
      const [w, , top] = sample(v.body, z);
      part(GEO.cyl, v.paint, side * w * 0.86, top + 0.072, z, 0.1, 0.15, 0.1);
      part(GEO.cyl, trim, side * w * 0.86, top + 0.15, z, 0.094, 0.065, 0.094);
      // Split line between the passenger doors follows the tumblehome at the sill.
      const split = van ? 0.42 : 0.08,
        [width, shoulder] = sample(v.body, split);
      panel(
        [side * (width + 0.002), 0.49, split],
        [side * (width + 0.002), shoulder, split],
        [side * (width + 0.002), shoulder, split + 0.012],
        [side * (width + 0.002), 0.49, split + 0.012],
        "#728792",
      );
    }
    part(GEO.box, trim, 0, 0.52, nose, 0.98, 0.085, 0.024);
    part(GEO.box, "#e6e9e7", 0, 0.66, rear, 0.36, 0.12, 0.025);
    part(GEO.domeB, v.paint, 0, v.lidarY - 0.24, v.lidarZ, 1, 1, 1);
  };
})();
