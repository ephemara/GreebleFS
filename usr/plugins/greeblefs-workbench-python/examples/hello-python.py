from pathlib import Path


def describe_workspace() -> str:
    cwd = Path.cwd()
    return f"Python workbench fixture running in {cwd}"


if __name__ == "__main__":
    print(describe_workspace())
