// hls.js ships no typings for its light build: reuse the full build's types.
declare module 'hls.js/light' {
	export { default } from 'hls.js';
	export * from 'hls.js';
}
