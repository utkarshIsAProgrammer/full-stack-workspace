import zlib, struct, sys

def decode_png(path):
    data = open(path, 'rb').read()
    pos = 8
    idat = b''
    while pos < len(data):
        ln = struct.unpack('>I', data[pos:pos+4])[0]
        typ = data[pos+4:pos+8]
        chunk = data[pos+8:pos+8+ln]
        if typ == b'IHDR':
            w, h, bd, ct = struct.unpack('>IIBB', chunk[:10])
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
def p(x,y):
    o=(y*w+x)*bpp; return px[o],px[o+1],px[o+2]

# PostModal textarea was at approx left=401 top=333 w=478 h=80 (viewport 1280x757 screenshot)
x0,x1,y0,y1 = 400, 880, 330, 415
print(f"Analyzing region x[{x0}-{x1}] y[{y0}-{y1}]")
for yy in [335, 345, 355, 365, 375, 385, 395]:
    row = []
    for xx in range(x0, x1, 6):
        r,g,b = p(xx, yy)
        row.append('#' if r>100 else ('.' if r>40 else '_'))
    print(yy, ''.join(row))
