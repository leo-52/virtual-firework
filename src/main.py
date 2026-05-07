"""Virtual Firework - 3D fireworks sandbox.

Controls:
  SPACE       launch a single firework
  A           toggle automatic launches
  ESC / Q     quit

Build a Windows .exe with: build.bat
"""
from __future__ import annotations

from ursina import Ursina, Text, color, time, application, held_keys

from firework import launch_random
from scene import build_scene


AUTO_INTERVAL = 0.9


class App:
    def __init__(self):
        self.engine = Ursina()
        build_scene()
        self.auto = True
        self.timer = 0.0
        self.help_text = Text(
            text="SPACE: launch    A: auto on/off    ESC: quit",
            origin=(0, 0),
            position=(0, -0.45),
            scale=1.1,
            color=color.rgb(220, 220, 220),
        )

    def update(self):
        if self.auto:
            self.timer += time.dt
            if self.timer >= AUTO_INTERVAL:
                self.timer = 0.0
                launch_random()

    def input(self, key):
        if key == "space":
            launch_random()
        elif key == "a":
            self.auto = not self.auto
        elif key in ("escape", "q"):
            application.quit()

    def run(self):
        self.engine.update = self.update
        self.engine.input = self.input
        self.engine.run()


def main():
    App().run()


if __name__ == "__main__":
    main()
