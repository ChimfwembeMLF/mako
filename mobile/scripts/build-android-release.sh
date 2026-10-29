#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ANDROID_DIR="${APP_DIR}/android"

SDK_DIR="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-$HOME/Library/Android/sdk}}"
SDKMANAGER_PATH=""
UPLOAD_DRIVE=0

usage() {
  cat <<'EOF'
Usage: ./scripts/build-android-release.sh [--upload-drive]

This script fixes the local Android toolchain needed for this Expo app and builds a
release APK. It will:
  - ensure JAVA_HOME is configured for JDK 17
  - detect the Android SDK location
  - install missing Android build packages if the SDK manager is available
  - write android/local.properties
  - run ./gradlew assembleRelease
  - optionally upload the APK to Google Drive if gdrive is installed

Options:
  --upload-drive   Upload the generated APK to Google Drive when gdrive is on PATH
  -h, --help       Show this help message
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --upload-drive)
      UPLOAD_DRIVE=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1"
      usage
      exit 1
      ;;
  esac
done

ensure_java17() {
  if [[ -n "${JAVA_HOME:-}" ]]; then
    return 0
  fi

  local java_home
  java_home="$(/usr/libexec/java_home -v 17 2>/dev/null || true)"
  if [[ -n "${java_home}" ]]; then
    export JAVA_HOME="${java_home}"
    export PATH="${JAVA_HOME}/bin:${PATH}"
    return 0
  fi

  echo "JDK 17 is required but not found. Install it from https://www.oracle.com/java/technologies/javase/jdk17-archive-downloads.html"
  echo "or via: brew install openjdk@17"
  exit 1
}

find_sdkmanager() {
  local candidates=(
    "$SDK_DIR/cmdline-tools/latest/bin/sdkmanager"
    "$SDK_DIR/cmdline-tools/bin/sdkmanager"
    "$SDK_DIR/tools/bin/sdkmanager"
    "$(which sdkmanager 2>/dev/null || true)"
  )

  for candidate in "${candidates[@]}"; do
    if [[ -n "${candidate}" && -x "${candidate}" ]]; then
      SDKMANAGER_PATH="${candidate}"
      return 0
    fi
  done

  return 1
}

install_android_sdk_if_needed() {
  if ! find_sdkmanager; then
    echo "Android SDK command-line tools were not found."
    echo "Please install Android Studio and the Android SDK, then rerun this script."
    echo "Typical SDK location on macOS: ${HOME}/Library/Android/sdk"
    exit 1
  fi

  mkdir -p "$SDK_DIR"

  local sdk_root_arg="--sdk_root=${SDK_DIR}"

  if [[ ! -d "${SDK_DIR}/platforms/android-36" ]]; then
    echo "Installing Android SDK packages..."
    yes | "${SDKMANAGER_PATH}" ${sdk_root_arg} "platform-tools" "platforms;android-36" "build-tools;36.0.0" "cmdline-tools;latest" >/dev/null
  fi

  if [[ ! -d "${SDK_DIR}/platforms/android-36" ]]; then
    echo "Android SDK installation is incomplete. Please open Android Studio -> SDK Manager and install the SDK packages."
    exit 1
  fi
}

write_local_properties() {
  cat > "${ANDROID_DIR}/local.properties" <<EOF
sdk.dir=${SDK_DIR}
EOF
}

build_release_apk() {
  local apk_path="${ANDROID_DIR}/app/build/outputs/apk/release/app-release.apk"

  echo "Running Android release build..."
  (cd "${ANDROID_DIR}" && ./gradlew assembleRelease)

  if [[ ! -f "${apk_path}" ]]; then
    echo "Release APK was not generated at: ${apk_path}"
    exit 1
  fi

  echo "APK created: ${apk_path}"
  echo "${apk_path}"
}

upload_to_google_drive() {
  local apk_path="${ANDROID_DIR}/app/build/outputs/apk/release/app-release.apk"

  if ! command -v gdrive >/dev/null 2>&1; then
    echo "Google Drive CLI (gdrive) is not installed."
    echo "Install it or upload the APK manually from: ${apk_path}"
    return 0
  fi

  echo "Uploading APK to Google Drive..."
  gdrive upload "${apk_path}"
}

main() {
  ensure_java17
  install_android_sdk_if_needed
  write_local_properties
  build_release_apk

  if (( UPLOAD_DRIVE )); then
    upload_to_google_drive
  fi
}

main "$@"
