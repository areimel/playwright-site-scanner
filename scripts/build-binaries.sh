#!/bin/bash

# Playwright Site Scanner - Binary Builder (Shell Version)
# Cross-platform binary generation script

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
OUTPUT_DIR="dist/binaries"
CLI_FILE="dist/cli.js"

log() {
    echo -e "${BLUE}$1${NC}"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

info() {
    echo -e "${CYAN}$1${NC}"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
check_prerequisites() {
    log "🔍 Checking prerequisites..."
    
    if ! command_exists npm; then
        error "npm is not installed or not in PATH"
        exit 1
    fi
    
    if ! command_exists npx; then
        error "npx is not installed or not in PATH"
        exit 1
    fi
    
    success "Prerequisites check passed"
}

# Build TypeScript
build_typescript() {
    log "🔨 Building TypeScript..."
    
    if npm run build; then
        success "TypeScript build completed"
    else
        error "TypeScript build failed"
        exit 1
    fi
}

# Verify CLI file
verify_cli_file() {
    if [ ! -f "$CLI_FILE" ]; then
        error "CLI file not found: $CLI_FILE"
        exit 1
    fi
    
    log "📄 CLI file verified: $CLI_FILE"
}

# Create output directory
create_output_dir() {
    if [ ! -d "$OUTPUT_DIR" ]; then
        mkdir -p "$OUTPUT_DIR"
        log "📁 Created directory: $OUTPUT_DIR"
    fi
}

# Build single binary
build_binary() {
    local target=$1
    local platform=$2
    local ext=$3
    
    local output_name="playwright-site-scanner-${platform}${ext}"
    local output_path="${OUTPUT_DIR}/${output_name}"
    
    log "📦 Building for $platform ($target)..."
    
    local start_time=$(date +%s)
    
    if npx pkg "$CLI_FILE" --targets "$target" --output "$output_path" --compress GZip; then
        local end_time=$(date +%s)
        local build_time=$((end_time - start_time))
        
        if [ -f "$output_path" ]; then
            local file_size=$(du -m "$output_path" | cut -f1)
            success "$platform binary created (${file_size}MB) in ${build_time}s"
            echo "$platform:$output_path:$file_size:$build_time:success"
        else
            error "Binary file was not created for $platform"
            echo "$platform:$output_path:0:$build_time:failed"
        fi
    else
        error "Failed to build $platform binary"
        echo "$platform:$output_path:0:0:failed"
    fi
}

# Build all binaries
build_all_binaries() {
    log "🎯 Building platform-specific binaries..."
    
    create_output_dir
    
    local results=()
    
    # Build Windows binary
    results+=($(build_binary "node18-win-x64" "windows" ".exe"))
    
    # Build macOS binary
    results+=($(build_binary "node18-macos-x64" "macos" ""))
    
    # Build Linux binary
    results+=($(build_binary "node18-linux-x64" "linux" ""))
    
    # Display results
    display_results "${results[@]}"
}

# Display build results
display_results() {
    local results=("$@")
    
    log "\n📊 Build Results Summary:"
    info "$(printf '=%.0s' {1..80})"
    
    local successful_count=0
    local total_size=0
    
    for result in "${results[@]}"; do
        IFS=':' read -r platform path size time status <<< "$result"
        
        if [ "$status" = "success" ]; then
            printf "${GREEN}   %-8s | %8sMB | %6ss | %s${NC}\n" "$platform" "$size" "$time" "$path"
            ((successful_count++))
            ((total_size += size))
        else
            printf "${RED}   %-8s | Build failed${NC}\n" "$platform"
        fi
    done
    
    info "$(printf '=%.0s' {1..80})"
    log "📈 Summary: $successful_count/${#results[@]} builds successful, Total size: ${total_size}MB"
    
    if [ $successful_count -gt 0 ]; then
        display_usage_instructions "${results[@]}"
    fi
}

# Display usage instructions
display_usage_instructions() {
    local results=("$@")
    
    log "💡 Usage:"
    for result in "${results[@]}"; do
        IFS=':' read -r platform path size time status <<< "$result"
        
        if [ "$status" = "success" ]; then
            local binary_name=$(basename "$path")
            if [ "$platform" = "windows" ]; then
                info "   $platform: .\\$binary_name"
            else
                info "   $platform: ./$binary_name"
            fi
        fi
    done
}

# Display post-build instructions
display_post_build_instructions() {
    log "📋 Next Steps:"
    warning "1. Test binaries on target platforms"
    warning "2. Verify browser detection and download functionality"
    warning "3. Create installers for distribution (optional)"
    warning "4. Update documentation with installation instructions"
    
    log "🔧 Binary Testing Commands:"
    info "   ./playwright-site-scanner-windows.exe browsers:check"
    info "   ./playwright-site-scanner-macos browsers:install"
    info "   ./playwright-site-scanner-linux start --download-browsers"
}

# Main function
main() {
    clear
    log "🚀 Playwright Site Scanner - Binary Builder\n"
    
    check_prerequisites
    build_typescript
    verify_cli_file
    build_all_binaries
    display_post_build_instructions
    
    success "🎉 Binary build process completed!"
}

# Run main function
main "$@"