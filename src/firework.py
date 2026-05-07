"""3D firework physics: a mortar that rises, then bursts into colored sparks."""
from __future__ import annotations

import math
import random

from ursina import Entity, color, destroy, time, Vec3

GRAVITY = Vec3(0, -9.81, 0)
SPARK_DRAG = 0.985
SPARK_LIFETIME = 2.2
MORTAR_LIFETIME = 3.0
BURST_PARTICLE_COUNT = 90
BURST_BASE_SPEED = 7.5


class Spark(Entity):
    """A single glowing particle that falls under gravity and fades out."""

    def __init__(self, position: Vec3, velocity: Vec3, tint, **kwargs):
        super().__init__(
            model="sphere",
            color=tint,
            scale=0.18,
            position=position,
            unlit=True,
            **kwargs,
        )
        self.velocity = velocity
        self.age = 0.0

    def update(self):
        dt = time.dt
        self.age += dt
        if self.age >= SPARK_LIFETIME:
            destroy(self)
            return
        self.velocity = (self.velocity + GRAVITY * dt) * SPARK_DRAG
        self.position += self.velocity * dt
        life_ratio = 1.0 - (self.age / SPARK_LIFETIME)
        self.scale = 0.18 * max(life_ratio, 0.05)
        self.alpha = life_ratio


class Mortar(Entity):
    """The shell that flies up, then explodes into a burst of sparks."""

    def __init__(self, launch_pos: Vec3, target_height: float, burst_color):
        super().__init__(
            model="sphere",
            color=color.white,
            scale=0.35,
            position=launch_pos,
            unlit=True,
        )
        rise_time = 1.4
        self.velocity = Vec3(
            random.uniform(-1.5, 1.5),
            (target_height - launch_pos.y) / rise_time + 0.5 * 9.81 * rise_time,
            random.uniform(-1.5, 1.5),
        )
        self.burst_color = burst_color
        self.age = 0.0
        self.exploded = False

    def update(self):
        if self.exploded:
            return
        dt = time.dt
        self.age += dt
        self.velocity += GRAVITY * dt
        self.position += self.velocity * dt
        if self.velocity.y <= 0 or self.age >= MORTAR_LIFETIME:
            self._burst()

    def _burst(self):
        self.exploded = True
        for _ in range(BURST_PARTICLE_COUNT):
            theta = random.uniform(0, 2 * math.pi)
            phi = math.acos(random.uniform(-1, 1))
            speed = BURST_BASE_SPEED * random.uniform(0.7, 1.1)
            direction = Vec3(
                math.sin(phi) * math.cos(theta),
                math.cos(phi),
                math.sin(phi) * math.sin(theta),
            )
            Spark(
                position=Vec3(self.position),
                velocity=direction * speed + self.velocity * 0.2,
                tint=self.burst_color,
            )
        destroy(self)


def launch_random(ground_radius: float = 12.0, height_range=(8.0, 14.0)):
    """Spawn a mortar at a random spot near the origin."""
    palette = [
        color.red, color.orange, color.yellow, color.lime,
        color.cyan, color.azure, color.magenta, color.violet, color.gold,
    ]
    launch_pos = Vec3(
        random.uniform(-ground_radius, ground_radius),
        0.2,
        random.uniform(-ground_radius, ground_radius),
    )
    Mortar(
        launch_pos=launch_pos,
        target_height=random.uniform(*height_range),
        burst_color=random.choice(palette),
    )
