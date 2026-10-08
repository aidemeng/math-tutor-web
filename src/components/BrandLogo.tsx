/** 品牌图形与 favicon、PWA 图标共用同一 SVG 源文件。 */
export function BrandLogo({ size = 28 }: { size?: number }) {
  return <img src="/favicon.svg" width={size} height={size} alt="" aria-hidden="true" style={{ display: 'block', flexShrink: 0 }} />;
}
