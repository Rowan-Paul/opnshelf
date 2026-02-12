import { Logger } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { ColorExtractionService } from "./color-extraction.service";

// Mock the jimp module
jest.mock("jimp", () => ({
	Jimp: {
		read: jest.fn(),
	},
}));

import { Jimp } from "jimp";

describe("ColorExtractionService", () => {
	let service: ColorExtractionService;

	beforeEach(async () => {
		jest.clearAllMocks();

		const module: TestingModule = await Test.createTestingModule({
			providers: [ColorExtractionService],
		}).compile();

		service = module.get<ColorExtractionService>(ColorExtractionService);

		// Spy on logger to suppress expected errors
		jest.spyOn(Logger.prototype, "error").mockImplementation(() => {});
	});

	it("should be defined", () => {
		expect(service).toBeDefined();
	});

	describe("extractColorsFromPoster", () => {
		it("should return null when posterPath is null", async () => {
			const result = await service.extractColorsFromPoster(null);
			expect(result).toBeNull();
			expect(Jimp.read).not.toHaveBeenCalled();
		});

		it("should return null when posterPath is empty string", async () => {
			const result = await service.extractColorsFromPoster("");
			expect(result).toBeNull();
			expect(Jimp.read).not.toHaveBeenCalled();
		});

		it("should extract colors from poster successfully", async () => {
			// Mock pixel data with distinct colors
			const mockPixels = new Uint8ClampedArray(60000); // 100 * 150 * 4
			// Set some pixels with distinct colors
			// Red pixel
			mockPixels[0] = 200;
			mockPixels[1] = 50;
			mockPixels[2] = 50;
			mockPixels[3] = 255;

			// Blue pixel
			mockPixels[12] = 50;
			mockPixels[13] = 50;
			mockPixels[14] = 200;
			mockPixels[15] = 255;

			// Green pixel
			mockPixels[24] = 50;
			mockPixels[25] = 200;
			mockPixels[26] = 50;
			mockPixels[27] = 255;

			// Yellow pixel
			mockPixels[36] = 200;
			mockPixels[37] = 200;
			mockPixels[38] = 50;
			mockPixels[39] = 255;

			const mockImage = {
				resize: jest.fn().mockReturnThis(),
				bitmap: {
					data: mockPixels,
				},
			};
			(Jimp.read as jest.Mock).mockResolvedValue(mockImage);

			const result = await service.extractColorsFromPoster("/poster.jpg");

			expect(Jimp.read).toHaveBeenCalledWith(
				"https://image.tmdb.org/t/p/w342/poster.jpg",
			);
			expect(mockImage.resize).toHaveBeenCalledWith({ w: 100, h: 150 });

			// Result should be a ColorPalette with 4 colors
			expect(result).toBeDefined();
			expect(result).toHaveProperty("primary");
			expect(result).toHaveProperty("secondary");
			expect(result).toHaveProperty("accent");
			expect(result).toHaveProperty("muted");

			// All values should be hex color strings
			expect(result?.primary).toMatch(/^#[0-9a-fA-F]{6}$/);
			expect(result?.secondary).toMatch(/^#[0-9a-fA-F]{6}$/);
			expect(result?.accent).toMatch(/^#[0-9a-fA-F]{6}$/);
			expect(result?.muted).toMatch(/^#[0-9a-fA-F]{6}$/);
		});

		it("should handle image loading errors gracefully", async () => {
			(Jimp.read as jest.Mock).mockRejectedValue(
				new Error("Failed to load image"),
			);

			const result = await service.extractColorsFromPoster("/poster.jpg");

			expect(result).toBeNull();
			expect(Logger.prototype.error).toHaveBeenCalled();
		});

		it("should handle image with all dark pixels", async () => {
			// Create dark pixels
			const mockPixels = new Uint8ClampedArray(60000);
			for (let i = 0; i < mockPixels.length; i += 4) {
				mockPixels[i] = 10; // R
				mockPixels[i + 1] = 10; // G
				mockPixels[i + 2] = 10; // B
				mockPixels[i + 3] = 255; // Alpha
			}

			const mockImage = {
				resize: jest.fn().mockReturnThis(),
				bitmap: {
					data: mockPixels,
				},
			};
			(Jimp.read as jest.Mock).mockResolvedValue(mockImage);

			const result = await service.extractColorsFromPoster("/dark-poster.jpg");

			// Should still return a palette, possibly with fallback colors
			expect(result).toBeDefined();
			expect(result).toHaveProperty("primary");
			expect(result).toHaveProperty("secondary");
			expect(result).toHaveProperty("accent");
			expect(result).toHaveProperty("muted");
		});

		it("should handle image with all bright pixels", async () => {
			// Create bright pixels
			const mockPixels = new Uint8ClampedArray(60000);
			for (let i = 0; i < mockPixels.length; i += 4) {
				mockPixels[i] = 250; // R
				mockPixels[i + 1] = 250; // G
				mockPixels[i + 2] = 250; // B
				mockPixels[i + 3] = 255; // Alpha
			}

			const mockImage = {
				resize: jest.fn().mockReturnThis(),
				bitmap: {
					data: mockPixels,
				},
			};
			(Jimp.read as jest.Mock).mockResolvedValue(mockImage);

			const result =
				await service.extractColorsFromPoster("/bright-poster.jpg");

			// Bright colors might be skipped, but should still return a palette
			expect(result).toBeDefined();
			expect(result).toHaveProperty("primary");
			expect(result).toHaveProperty("secondary");
			expect(result).toHaveProperty("accent");
			expect(result).toHaveProperty("muted");
		});

		it("should skip pixels with transparency", async () => {
			// Mix of opaque and transparent pixels
			const mockPixels = new Uint8ClampedArray(60000);
			for (let i = 0; i < mockPixels.length; i += 4) {
				mockPixels[i] = 100; // R
				mockPixels[i + 1] = 100; // G
				mockPixels[i + 2] = 100; // B
				mockPixels[i + 3] = i % 8 === 0 ? 0 : 255; // Mix of transparent and opaque
			}

			const mockImage = {
				resize: jest.fn().mockReturnThis(),
				bitmap: {
					data: mockPixels,
				},
			};
			(Jimp.read as jest.Mock).mockResolvedValue(mockImage);

			const result = await service.extractColorsFromPoster("/mixed-poster.jpg");

			expect(result).toBeDefined();
			expect(result).toHaveProperty("primary");
		});
	});

	describe("calculateSaturation", () => {
		it("should return 0 for grayscale colors (no saturation)", () => {
			const saturation = (service as any).calculateSaturation(128, 128, 128);
			expect(saturation).toBe(0);
		});

		it("should return 1 for pure red (max saturation)", () => {
			const saturation = (service as any).calculateSaturation(255, 0, 0);
			expect(saturation).toBe(1);
		});

		it("should return 1 for pure green (max saturation)", () => {
			const saturation = (service as any).calculateSaturation(0, 255, 0);
			expect(saturation).toBe(1);
		});

		it("should return 1 for pure blue (max saturation)", () => {
			const saturation = (service as any).calculateSaturation(0, 0, 255);
			expect(saturation).toBe(1);
		});

		it("should return 0 for black (no saturation)", () => {
			const saturation = (service as any).calculateSaturation(0, 0, 0);
			expect(saturation).toBe(0);
		});

		it("should return 0 for white (no saturation)", () => {
			const saturation = (service as any).calculateSaturation(255, 255, 255);
			expect(saturation).toBe(0);
		});

		it("should calculate partial saturation correctly", () => {
			// Orange: 255, 128, 0 - saturation should be (255-0)/255 = 1
			const saturationOrange = (service as any).calculateSaturation(
				255,
				128,
				0,
			);
			expect(saturationOrange).toBeCloseTo(1, 5);

			// Pink: 255, 192, 203 - saturation should be (255-192)/255 ≈ 0.247
			const saturationPink = (service as any).calculateSaturation(
				255,
				192,
				203,
			);
			expect(saturationPink).toBeCloseTo((255 - 192) / 255, 5);
		});
	});

	describe("colorDistance", () => {
		it("should return 0 for identical colors", () => {
			const distance = (service as any).colorDistance(
				{ r: 100, g: 150, b: 200 },
				{ r: 100, g: 150, b: 200 },
			);
			expect(distance).toBe(0);
		});

		it("should calculate Euclidean distance correctly", () => {
			const distance = (service as any).colorDistance(
				{ r: 0, g: 0, b: 0 },
				{ r: 3, g: 4, b: 0 },
			);
			expect(distance).toBe(5); // sqrt(9 + 16 + 0) = 5
		});

		it("should return distance > 40 for distinctly different colors", () => {
			const distance = (service as any).colorDistance(
				{ r: 255, g: 0, b: 0 },
				{ r: 0, g: 255, b: 0 },
			);
			expect(distance).toBeGreaterThan(40);
		});

		it("should return distance < 40 for similar colors", () => {
			const distance = (service as any).colorDistance(
				{ r: 100, g: 100, b: 100 },
				{ r: 105, g: 105, b: 105 },
			);
			expect(distance).toBeLessThan(40);
		});
	});

	describe("adjustColorBoldness", () => {
		it("should boost saturation of red channel when it is max", () => {
			const result = (service as any).adjustColorBoldness({
				r: 200,
				g: 100,
				b: 50,
			});
			expect(result.r).toBeGreaterThan(200);
			expect(result.r).toBeLessThanOrEqual(255);
		});

		it("should reduce saturation of red channel when it is min", () => {
			const result = (service as any).adjustColorBoldness({
				r: 50,
				g: 200,
				b: 150,
			});
			expect(result.r).toBeLessThan(50);
		});

		it("should boost brightness of dark colors", () => {
			const result = (service as any).adjustColorBoldness({
				r: 20,
				g: 20,
				b: 20,
			});
			const brightness = (result.r + result.g + result.b) / 3;
			expect(brightness).toBeGreaterThanOrEqual(60);
		});

		it("should clamp values to valid RGB range", () => {
			const result = (service as any).adjustColorBoldness({
				r: 250,
				g: 250,
				b: 250,
			});
			expect(result.r).toBeLessThanOrEqual(255);
			expect(result.g).toBeLessThanOrEqual(255);
			expect(result.b).toBeLessThanOrEqual(255);
			expect(result.r).toBeGreaterThanOrEqual(0);
			expect(result.g).toBeGreaterThanOrEqual(0);
			expect(result.b).toBeGreaterThanOrEqual(0);
		});

		it("should handle mid-range colors without extreme adjustments", () => {
			const result = (service as any).adjustColorBoldness({
				r: 128,
				g: 128,
				b: 128,
			});
			expect(result.r).toBeGreaterThanOrEqual(60);
			expect(result.g).toBeGreaterThanOrEqual(60);
			expect(result.b).toBeGreaterThanOrEqual(60);
		});
	});

	describe("rgbToHex", () => {
		it("should convert pure red to hex", () => {
			const hex = (service as any).rgbToHex({ r: 255, g: 0, b: 0 });
			expect(hex).toBe("#ff0000");
		});

		it("should convert pure green to hex", () => {
			const hex = (service as any).rgbToHex({ r: 0, g: 255, b: 0 });
			expect(hex).toBe("#00ff00");
		});

		it("should convert pure blue to hex", () => {
			const hex = (service as any).rgbToHex({ r: 0, g: 0, b: 255 });
			expect(hex).toBe("#0000ff");
		});

		it("should convert white to hex", () => {
			const hex = (service as any).rgbToHex({ r: 255, g: 255, b: 255 });
			expect(hex).toBe("#ffffff");
		});

		it("should convert black to hex", () => {
			const hex = (service as any).rgbToHex({ r: 0, g: 0, b: 0 });
			expect(hex).toBe("#000000");
		});

		it("should pad single digit hex values with zero", () => {
			const hex = (service as any).rgbToHex({ r: 15, g: 15, b: 15 });
			expect(hex).toBe("#0f0f0f");
		});

		it("should handle mid-range colors", () => {
			const hex = (service as any).rgbToHex({ r: 128, g: 64, b: 192 });
			expect(hex).toBe("#8040c0");
		});

		it("should always return lowercase hex", () => {
			const hex = (service as any).rgbToHex({ r: 170, g: 187, b: 204 });
			expect(hex).toBe("#aabbcc");
			expect(hex).not.toMatch(/[A-F]/);
		});
	});
});
