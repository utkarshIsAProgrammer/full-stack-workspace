import zlib, struct, sys

def decode_png(path):
    data = open(path, 'rb').read()
    pos = 8
    idat = b''
    while pos < len(data):
        ln = struct.unpack('>I', data[pos:pos+4])[0]
        typ = data[pos+4:pos+8]
        chunk = data[pos+8:pos+8+ln]
        if typ == b'IHDR': w,h,bd,ct = struct.unpack('>IIBB', chunk[:10])
        elif typ == b'IDAT': idat += chunk
        elif typ == b'IEND': break
        pos += 12 + ln
    raw = zlib.decompress(idat)
    ch = {0:1,2:3,3:1,4:2,6:4}[ct]
    stride = w*ch
    out = bytearray(w*h*ch); prev = bytearray(stride); i = 0
    for y in range(h):
        f = raw[i]; i += 1
        line = bytearray(raw[i:i+stride]); i += stride
        if f==1:
            for x in range(ch, stride): line[x]=(line[x]+line[x-ch])&255
        elif f==2:
            for x in range(stride): line[x]=(line[x]+prev[x])&255
        elif f==3:
            for x in range(stride):
                a=line[x-ch] if x>=ch else 0
                line[x]=(line[x]+((a+prev[x])>>1))&255
        elif f==4:
            for x in range(stride):
                a=line[x-ch] if x>=ch else 0; b=prev[x]; c=prev[x-ch] if x>=ch else 0
                p=a+b-c; pa,pb,pc=abs(p-a),abs(p-b),abs(p-c)
                pr=a if (pa<=pb and pa<=pc) else (b if pb<=pc else c)
                line[x]=(line[x]+pr)&255
        out[y*stride:(y+1)*stride]=line; prev=line
    return w,h,ch,out

w,h,bpp,px = decode_png(sys.argv[1])
def lum(x,y):
    o=(y*w+x)*bpp
    return 0.299*px[o]+0.587*px[o+1]+0.114*px[o+2]

# Find the brightest horizontal band (the typed text line) in the textarea region
# textarea approx: left=401 top=333 w=478 h=80
best = None
for y in range(330, 420):
    s = sum(1 for x in range(400, 880) if lum(x,y) > 90)
    if best is None or s > best[0]: best = (s, y)
print("brightest row y=", best)
if best:
    y = best[1]
    # Scan left to right, mark glyph presence per pixel
    glyphs = []
    for x in range(398, 880):
        glyphs.append('#' if lum(x,y) > 90 else ' ')
    s = ''.join(glyphs)
    # Print with markers every 10 px
    print("  400 |" + s + "| 880")
    # find first glyph x
    for x in range(398, 880):
        if lum(x,y) > 90:
            print("FIRST GLYPH at x=", x); break
    # Count how wide the empty leading region is
    empty = 0
    for x in range(398, 880):
        if lum(x,y) <= 90: empty += 1
        else: break
    print("leading empty px:", empty)
