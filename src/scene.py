"""Build the static night-sky scene: ground, stars, camera."""
from __future__ import annotations

import random

from ursina import Entity, EditorCamera, Sky, color, window, Vec3


def build_scene():
    window.title = "Virtual Firework"
    window.color = color.rgb(5, 5, 18)
    window.borderless = False
    window.fullscreen = False
    window.exit_button.visible = False
    window.fps_counter.visible = False

    Sky(color=color.rgb(5, 5, 18))

    Entity(
        model="plane",
        scale=80,
        color=color.rgb(15, 15, 25),
        texture="white_cube",
        texture_scale=(40, 40),
        position=(0, 0, 0),
    )

    for _ in range(180):
        Entity(
            model="sphere",
            scale=0.05,
            color=color.white,
            unlit=True,
            position=Vec3(
                random.uniform(-40, 40),
                random.uniform(15, 35),
                random.uniform(-40, 40),
            ),
        )

    cam = EditorCamera()
    cam.position = (0, 6, -22)
    cam.rotation_x = 10
    return cam
