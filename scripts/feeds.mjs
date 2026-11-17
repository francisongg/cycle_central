// Product feed for shopping channels: Google Merchant Center (free listings), Microsoft
// Merchant Center (Bing) and Meta Commerce Manager (Facebook and Instagram shops) all read
// this RSS 2.0 format. One item per SKU, grouped by model with item_group_id.
// Published at /feeds/products.xml; add that address as a scheduled feed in each channel.

const xml = (s) => String(s ?? "").replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]));
const plain = (t) => String(t || "").replace(/\s+/g, " ").trim();

export function productFeed(products, { site, abs, categories, policies = {} }) {
  const catOf = (id) => categories.find((c) => c.id === id);
  const days = Array.isArray(policies.deliveryDays) ? +policies.deliveryDays[1] : null;
  const items = [];
  for (const p of products) {
    const c = catOf(p.category);
    const type = c ? `${c.type === "bike" ? "Bikes" : "Parts & Gear"} > ${p.frameset ? "Framesets" : c.type === "bike" ? `${c.label} Bikes` : c.label}` : "";
    const description = plain(p.description) || `${p.name}${c ? `, ${(c.singular || c.label).toLowerCase()}` : ""} from ${site.name}.`;
    for (const v of p.variants || []) {
      const colour = (p.colors || [])[v.color] || {};
      const photos = (colour.photos && colour.photos.length ? colour.photos : p.photos) || [];
      const main = colour.feedImage || p.feedImage || photos[0];
      if (!main) continue; // every shopping channel needs a photo
      const colourName = colour.name && colour.name !== "Standard" ? colour.name : "";
      const title = [p.name, colourName, v.size].filter(Boolean).join(" - ");
      const sale = v.compareAt && v.compareAt > v.price;
      const avail = v.inStock ? "in_stock" : "backorder";
      items.push(`    <item>
      <g:id>${xml(v.sku)}</g:id>
      <g:item_group_id>${xml(p.slug)}</g:item_group_id>
      <g:title>${xml(title.slice(0, 150))}</g:title>
      <g:description>${xml(description.slice(0, 5000))}</g:description>
      <g:link>${xml(abs(`products/${v.path}/`))}</g:link>
      <g:image_link>${xml(abs(main))}</g:image_link>
${photos.filter((u) => u !== main).slice(0, 10).map((u) => `      <g:additional_image_link>${xml(abs(u))}</g:additional_image_link>`).join("\n")}
      <g:availability>${avail}</g:availability>${avail === "backorder" && days ? `
      <g:availability_date>${new Date(Date.now() + days * 86400000).toISOString().slice(0, 10)}</g:availability_date>` : ""}
      <g:price>${(sale ? v.compareAt : v.price).toFixed(2)} ${site.currency}</g:price>${sale ? `
      <g:sale_price>${v.price.toFixed(2)} ${site.currency}</g:sale_price>` : ""}
      <g:condition>new</g:condition>${p.brand ? `
      <g:brand>${xml(p.brand)}</g:brand>` : ""}${colourName ? `
      <g:color>${xml(colourName)}</g:color>` : ""}${v.size ? `
      <g:size>${xml(v.size)}</g:size>` : ""}${type ? `
      <g:product_type>${xml(type)}</g:product_type>` : ""}
    </item>`.replace(/\n\n/g, "\n"));
    }
  }
  return { count: items.length, xml: `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${xml(site.name)}</title>
    <link>${xml(abs(""))}</link>
    <description>${xml(site.description)}</description>
${items.join("\n")}
  </channel>
</rss>
` };
}
